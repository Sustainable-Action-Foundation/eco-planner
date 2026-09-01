import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import { GeoAreaType } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

export const CuratedHistoricalCategory = {
  WindPower: "WIND_POWER",
  SolarPower: "SOLAR_POWER",
  Vehicles: "VEHICLES",
} as const;
export type CuratedHistoricalCategory = (typeof CuratedHistoricalCategory)[keyof typeof CuratedHistoricalCategory];

/** How a geo area is injected into a source's selection when it is fetched. */
export const CuratedRegionKind = {
  /** The region dimension's value codes are the geo area codes themselves (SCB's tables). */
  PxWebCode: "PXWEB_CODE",
  /**
   * The region dimension's value codes are positional ("0", "1", ...) and the
   * geo area code only appears as a prefix of the value label, e.g.
   * "0180 Stockholm" (Energimyndigheten's tables).
   */
  PxWebLabelPrefix: "PXWEB_LABEL_PREFIX",
  /** Trafa's reglan/regkom hierarchy; the nation is the query without any region dimension. */
  Trafa: "TRAFA",
  /** The table has no region dimension for this level (e.g. a national-only table). */
  None: "NONE",
} as const;
export type CuratedRegionKind = (typeof CuratedRegionKind)[keyof typeof CuratedRegionKind];

export type CuratedRegion =
  | { kind: typeof CuratedRegionKind.PxWebCode | typeof CuratedRegionKind.PxWebLabelPrefix, variableCode: string }
  | { kind: typeof CuratedRegionKind.Trafa | typeof CuratedRegionKind.None };

export type CuratedSource = {
  dataset: DatasetKeys;
  tableId: string;
  /**
   * Dimension selection excluding region (injected per geo area, see `region`)
   * and time. The time dimension is omitted on purpose: the pxWeb layer expands
   * a missing time dimension to all available periods, and the Trafa layer
   * always queries all years, which is exactly what a browsable series wants.
   */
  selection: ApiSelectionItem[];
  region: CuratedRegion;
};

export type CuratedSeries = {
  /** Stable identifier within the entry; also used as a React key. */
  key: string;
  name: string;
  /** Source per geo area level. Levels without a source are skipped for that area. */
  sources: Partial<Record<GeoAreaType, CuratedSource>>;
};

export type CuratedHistoricalEntry = {
  /** Stable identifier for the entry; also used as a React key. */
  key: string;
  category: CuratedHistoricalCategory;
  name: string;
  description: string;
  /**
   * Display unit, shared by all series in the entry. Declared here rather than
   * read from the source table, since table metadata units are inconsistent
   * (e.g. Energimyndigheten reports "Antal, MW, GWh" for every category).
   */
  unit: string | null;
  /** One chart per entry; multi-series entries render one line per series. */
  series: CuratedSeries[];
};

export type CuratedHistoricalCatalog = {
  title: string;
  description: string;
  entries: CuratedHistoricalEntry[];
};

/** The same source serves every geo area level. */
function allLevels(source: CuratedSource): CuratedSeries["sources"] {
  return {
    [GeoAreaType.NATION]: source,
    [GeoAreaType.COUNTY]: source,
    [GeoAreaType.MUNICIPALITY]: source,
  };
}

/**
 * The curated set of historical statistics shown on an org's landing page,
 * localized to the org's geo area: the energy and transport transition series
 * selected by the domain experts. Areas missing from a table simply drop that
 * series.
 *
 * @param areaName Interpolated into the catalog title.
 */
export function getCuratedHistoricalCatalog(t: TFunction, areaName: string): CuratedHistoricalCatalog {
  return {
    title: t("pages:home.curated_historical.title", { area: areaName }),
    description: t("pages:home.curated_historical.description"),
    entries: getEnergyTransportEntries(t),
  };
}

/**
 * Energimyndigheten splits its wind power statistics into one table per level
 * (EN0105_1 nation, EN0105_3 county, EN0105_4 municipality) with the same
 * "Kategori" codes; the national table lacks electricity production at the
 * municipal level. Value codes are positional, so regions resolve by label.
 */
function windPowerSources(kategori: string, { municipal }: { municipal: boolean }): CuratedSeries["sources"] {
  const selection: ApiSelectionItem[] = [
    { variableCode: "CONTENTS", valueCodes: ["content"] },
    { variableCode: "Kategori", valueCodes: [kategori] },
  ];
  return {
    [GeoAreaType.NATION]: { dataset: "STEM", tableId: "EN0105_1", selection, region: { kind: CuratedRegionKind.None } },
    [GeoAreaType.COUNTY]: { dataset: "STEM", tableId: "EN0105_3", selection, region: { kind: CuratedRegionKind.PxWebLabelPrefix, variableCode: "Län" } },
    ...(municipal ? {
      [GeoAreaType.MUNICIPALITY]: { dataset: "STEM", tableId: "EN0105_4", selection, region: { kind: CuratedRegionKind.PxWebLabelPrefix, variableCode: "Kommun" } } satisfies CuratedSource,
    } : {}),
  };
}

/** EN0123_1 covers every level in one "Region" dimension ("00 Riket", "01 Stockholms län", "0114 Upplands Väsby", ...). */
function solarPowerSource(kategori: string): CuratedSource {
  return {
    dataset: "STEM",
    tableId: "EN0123_1",
    selection: [
      { variableCode: "CONTENTS", valueCodes: ["content"] },
      // All size classes ("Totalt")
      { variableCode: "Effektklass", valueCodes: ["3"] },
      { variableCode: "Kategori", valueCodes: [kategori] },
    ],
    region: { kind: CuratedRegionKind.PxWebLabelPrefix, variableCode: "Region" },
  };
}

/** Trafa t10026 (passenger cars): count in traffic at year end, for one "drivmedel" (fuel) code. */
function carsByFuelSource(drivmedel: string): CuratedSource {
  return {
    dataset: "Trafa",
    tableId: "t10026",
    selection: [
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      { variableCode: "drivmedel", valueCodes: [drivmedel] },
    ],
    region: { kind: CuratedRegionKind.Trafa },
  };
}

function getEnergyTransportEntries(t: TFunction): CuratedHistoricalEntry[] {
  return [
    {
      key: "wind-turbines",
      category: CuratedHistoricalCategory.WindPower,
      name: t("pages:home.curated_historical.wind_turbines_name"),
      description: t("pages:home.curated_historical.wind_turbines_description"),
      unit: null,
      series: [{
        key: "wind-turbines",
        name: t("pages:home.curated_historical.wind_turbines_name"),
        sources: windPowerSources("0", { municipal: true }),
      }],
    },
    {
      key: "wind-capacity",
      category: CuratedHistoricalCategory.WindPower,
      name: t("pages:home.curated_historical.wind_capacity_name"),
      description: t("pages:home.curated_historical.wind_capacity_description"),
      unit: "MW",
      series: [{
        key: "wind-capacity",
        name: t("pages:home.curated_historical.wind_capacity_name"),
        sources: windPowerSources("1", { municipal: true }),
      }],
    },
    {
      key: "wind-production",
      category: CuratedHistoricalCategory.WindPower,
      name: t("pages:home.curated_historical.wind_production_name"),
      description: t("pages:home.curated_historical.wind_production_description"),
      unit: "GWh",
      series: [{
        key: "wind-production",
        name: t("pages:home.curated_historical.wind_production_name"),
        sources: windPowerSources("2", { municipal: false }),
      }],
    },
    {
      key: "solar-installations",
      category: CuratedHistoricalCategory.SolarPower,
      name: t("pages:home.curated_historical.solar_installations_name"),
      description: t("pages:home.curated_historical.solar_installations_description"),
      unit: null,
      series: [{
        key: "solar-installations",
        name: t("pages:home.curated_historical.solar_installations_name"),
        sources: allLevels(solarPowerSource("0")),
      }],
    },
    {
      key: "solar-capacity",
      category: CuratedHistoricalCategory.SolarPower,
      name: t("pages:home.curated_historical.solar_capacity_name"),
      description: t("pages:home.curated_historical.solar_capacity_description"),
      unit: "MW",
      series: [{
        key: "solar-capacity",
        name: t("pages:home.curated_historical.solar_capacity_name"),
        sources: allLevels(solarPowerSource("1")),
      }],
    },
    {
      key: "cars-by-fuel",
      category: CuratedHistoricalCategory.Vehicles,
      name: t("pages:home.curated_historical.cars_by_fuel_name"),
      description: t("pages:home.curated_historical.cars_by_fuel_description"),
      unit: null,
      // Every fuel in the table's "drivmedel" dimension except the total, which
      // would flatten the others in a shared chart
      series: [
        { key: "petrol", name: t("pages:home.curated_historical.fuel_petrol"), sources: allLevels(carsByFuelSource("101")) },
        { key: "diesel", name: t("pages:home.curated_historical.fuel_diesel"), sources: allLevels(carsByFuelSource("102")) },
        { key: "electric", name: t("pages:home.curated_historical.fuel_electric"), sources: allLevels(carsByFuelSource("103")) },
        { key: "hybrid", name: t("pages:home.curated_historical.fuel_hybrid"), sources: allLevels(carsByFuelSource("104")) },
        { key: "plugin-hybrid", name: t("pages:home.curated_historical.fuel_plugin_hybrid"), sources: allLevels(carsByFuelSource("105")) },
        { key: "ethanol", name: t("pages:home.curated_historical.fuel_ethanol"), sources: allLevels(carsByFuelSource("106")) },
        { key: "gas", name: t("pages:home.curated_historical.fuel_gas"), sources: allLevels(carsByFuelSource("107")) },
        { key: "other", name: t("pages:home.curated_historical.fuel_other"), sources: allLevels(carsByFuelSource("109")) },
      ],
    },
  ];
}

/**
 * Finds the positional value code whose label starts with the geo area code,
 * for `PxWebLabelPrefix` regions. The trailing space matters: "01 " must not
 * match "0114 Upplands Väsby".
 */
export function findRegionCodeByLabel(options: { value: string, label?: string }[], geoAreaCode: string): string | null {
  return options.find(option => option.label?.startsWith(`${geoAreaCode} `))?.value ?? null;
}

/**
 * The selection items that scope a source to one geo area, to be combined with
 * the source's fixed selection. Returns null when the area can't be expressed
 * (a label-resolved region the table doesn't list).
 *
 * @param positionalCode The resolved value code for `PxWebLabelPrefix` regions (see {@link findRegionCodeByLabel}); ignored otherwise.
 */
export function buildRegionSelection(region: CuratedRegion, geoArea: { code: string, type: GeoAreaType }, positionalCode: string | null = null): ApiSelectionItem[] | null {
  switch (region.kind) {
    case CuratedRegionKind.None: {
      return [];
    }
    case CuratedRegionKind.PxWebCode: {
      return [{ variableCode: region.variableCode, valueCodes: [geoArea.code] }];
    }
    case CuratedRegionKind.PxWebLabelPrefix: {
      return positionalCode ? [{ variableCode: region.variableCode, valueCodes: [positionalCode] }] : null;
    }
    case CuratedRegionKind.Trafa: {
      return buildTrafaRegionSelection(geoArea);
    }
    default: {
      throw new Error(`Unknown curated region kind "${String((region satisfies never as CuratedRegion).kind)}"`);
    }
  }
}

function buildTrafaRegionSelection(geoArea: { code: string, type: GeoAreaType }): ApiSelectionItem[] {
  switch (geoArea.type) {
    case GeoAreaType.NATION: {
      // Omitting the region dimensions yields the national total
      return [];
    }
    case GeoAreaType.COUNTY: {
      return [{ variableCode: "reglan", valueCodes: [geoArea.code] }];
    }
    case GeoAreaType.MUNICIPALITY: {
      // Trafa returns nothing for a municipality unless its county is selected too
      return [
        { variableCode: "reglan", valueCodes: [geoArea.code.slice(0, 2)] },
        { variableCode: "regkom", valueCodes: [geoArea.code] },
      ];
    }
    default: {
      throw new Error(`Unknown geo area type "${String(geoArea.type satisfies never)}"`);
    }
  }
}
