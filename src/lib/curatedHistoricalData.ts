import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import { GeoAreaType } from "@/lib/prisma/generated";
import type { TFunction } from "i18next";

export const CuratedHistoricalCategory = {
  WindPower: "WIND_POWER",
  SolarPower: "SOLAR_POWER",
  Vehicles: "VEHICLES",
  HydroPower: "HYDRO_POWER",
  DistrictHeating: "DISTRICT_HEATING",
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
   * Unit shared by all series in the entry, both for display and as the unit a
   * goal started from the entry gets, so it has to parse (see `parseUnit` and
   * the custom units in `src/math.ts`; counts are "antal"). Declared here
   * rather than read from the source table, since table metadata units are
   * inconsistent (e.g. Energimyndigheten reports "Antal, MW, GWh" for every
   * category).
   */
  unit: string | null;
  /** One chart per entry; multi-series entries render one line per series. */
  series: CuratedSeries[];
  /**
   * Shown on the org landing page and browsable on its own page (the default);
   * unlisted entries only serve as local counterparts of national goals (see
   * `getNationalGoalMappings`).
   */
  listed?: boolean;
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

/** SCB municipal energy statistics: one production type of a table, every level in the "Region" dimension. */
function scbEnergySource(tableId: string, contentsCode: string, productionType: string, fuel: string): CuratedSource {
  return {
    dataset: "SCB",
    tableId,
    selection: [
      { variableCode: "Produktionssatt", valueCodes: [productionType] },
      { variableCode: "Bransle", valueCodes: [fuel] },
      { variableCode: "ContentsCode", valueCodes: [contentsCode] },
    ],
    region: { kind: CuratedRegionKind.PxWebCode, variableCode: "Region" },
  };
}

/** Trafa t10023 (trucks): count in traffic at year end for one truck type ("fslagh": 22 light, 23 heavy) and fuel. */
function trucksByFuelSource(truckType: string, drivmedel: string): CuratedSource {
  return {
    dataset: "Trafa",
    tableId: "t10023",
    selection: [
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      { variableCode: "fslagh", valueCodes: [truckType] },
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
      unit: "antal",
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
      unit: "antal",
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
      unit: "antal",
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
    // Local counterparts of national goals only (see getNationalGoalMappings); not browsed
    {
      key: "light-trucks-by-fuel",
      category: CuratedHistoricalCategory.Vehicles,
      name: t("pages:home.curated_historical.light_trucks_by_fuel_name"),
      description: t("pages:home.curated_historical.light_trucks_by_fuel_description"),
      unit: "antal",
      listed: false,
      series: [
        { key: "petrol", name: t("pages:home.curated_historical.fuel_petrol"), sources: allLevels(trucksByFuelSource("22", "101")) },
        { key: "diesel", name: t("pages:home.curated_historical.fuel_diesel"), sources: allLevels(trucksByFuelSource("22", "102")) },
        { key: "electric", name: t("pages:home.curated_historical.fuel_electric"), sources: allLevels(trucksByFuelSource("22", "103")) },
        { key: "plugin-hybrid", name: t("pages:home.curated_historical.fuel_plugin_hybrid"), sources: allLevels(trucksByFuelSource("22", "105")) },
        { key: "ethanol", name: t("pages:home.curated_historical.fuel_ethanol"), sources: allLevels(trucksByFuelSource("22", "106")) },
        { key: "gas", name: t("pages:home.curated_historical.fuel_gas"), sources: allLevels(trucksByFuelSource("22", "107")) },
      ],
    },
    {
      key: "hydro-production",
      category: CuratedHistoricalCategory.HydroPower,
      name: t("pages:home.curated_historical.hydro_production_name"),
      description: t("pages:home.curated_historical.hydro_production_description"),
      unit: "MWh",
      listed: false,
      series: [{
        key: "hydro-production",
        name: t("pages:home.curated_historical.hydro_production_name"),
        sources: allLevels(scbEnergySource("TAB3451", "EN0203AD", "4.1", "17")),
      }],
    },
    {
      key: "district-heating-production",
      category: CuratedHistoricalCategory.DistrictHeating,
      name: t("pages:home.curated_historical.district_heating_production_name"),
      description: t("pages:home.curated_historical.district_heating_production_description"),
      unit: "MWh",
      listed: false,
      series: [{
        key: "district-heating-production",
        name: t("pages:home.curated_historical.district_heating_production_name"),
        sources: allLevels(scbEnergySource("TAB3452", "EN0203AC", "Totalt", "20")),
      }],
    },
  ];
}

/**
 * A national goal (by LEAP indicator parameter) and the curated series that
 * measure the same thing locally, in order of preference: the first series
 * with data for an org's area is the one offered when the goal is copied.
 */
export type NationalGoalMapping = {
  indicatorParameter: string;
  series: { entryKey: string, seriesKey: string }[];
};

/**
 * Which national goals an org can copy with its own historical data: the
 * goals in the national scenarios whose indicator parameter is one of these.
 * Kept next to the catalog since the two have to agree on entry/series keys.
 *
 * Units are not reconciled here (LEAP labels annual wind and solar production
 * "GW" where the statistics are GWh and MW): copies scale the national goal by
 * the local share of the statistic, which is a plain ratio, so the copy keeps
 * the national goal's unit.
 */
export function getNationalGoalMappings(): NationalGoalMapping[] {
  const carsByFuel = (fuel: string, seriesKey: string): NationalGoalMapping => ({
    indicatorParameter: `Key\\Landtransporter\\Personbilar\\${fuel}\\Antal bilar`,
    series: [{ entryKey: "cars-by-fuel", seriesKey }],
  });
  const production = (source: string) => `Key\\Energiomvandlingsanläggningar\\Årlig elproduktion\\${source}`;

  return [
    carsByFuel("Bensinbilar", "petrol"),
    carsByFuel("Dieselbilar", "diesel"),
    carsByFuel("Elbilar", "electric"),
    carsByFuel("Etanolbilar", "ethanol"),
    carsByFuel("Fordonsgasbilar", "gas"),
    carsByFuel("Laddhybridbilar", "plugin-hybrid"),
    {
      indicatorParameter: production("Vindkraft landbaserad"),
      // Production is the closer measure but has no municipal table; capacity covers every level
      series: [
        { entryKey: "wind-production", seriesKey: "wind-production" },
        { entryKey: "wind-capacity", seriesKey: "wind-capacity" },
      ],
    },
    { indicatorParameter: production("Solkraft tak"), series: [{ entryKey: "solar-capacity", seriesKey: "solar-capacity" }] },
    { indicatorParameter: production("Solkraft mark"), series: [{ entryKey: "solar-capacity", seriesKey: "solar-capacity" }] },
    { indicatorParameter: production("Vattenkraft"), series: [{ entryKey: "hydro-production", seriesKey: "hydro-production" }] },
    {
      indicatorParameter: `Key\\Energiomvandlingsanläggningar\\Årlig fjärrvärmeproduktion\\Kraftvärme och värmeverk`,
      series: [{ entryKey: "district-heating-production", seriesKey: "district-heating-production" }],
    },
    ...[["bensin", "petrol"], ["diesel", "diesel"], ["el", "electric"], ["laddhybrid", "plugin-hybrid"], ["etanol", "ethanol"], ["fordonsgas", "gas"]].map(([fuel, seriesKey]) => ({
      indicatorParameter: `Key\\Landtransporter\\Lätta lastbilar\\${fuel}lastbilar`,
      series: [{ entryKey: "light-trucks-by-fuel", seriesKey }],
    })),
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
