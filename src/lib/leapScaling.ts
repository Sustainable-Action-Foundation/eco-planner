import { CuratedRegionKind } from "@/lib/curatedHistoricalData";
import type { CuratedRegion } from "@/lib/curatedHistoricalData";
import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";
import { GeoAreaType } from "@/lib/prisma/generated";

/*
 * How a national LEAP goal is scaled to a local area, per indicator parameter,
 * after Martin's mapping of LEAP rows to SCB, Energimyndigheten and Trafa
 * tables (ignore/martin-mail/external-sources/leap-scaling-tables.md, 2026-09-11).
 * The doc's four "naive scaling" rules:
 *
 * 1. Intensities and shares (kWh/m², percent, per capita) are copied as they are.
 * 2. Resident-driven totals scale by population, per year with the forecasts.
 * 3. Sector totals scale by the sector's own local energy use, never by population.
 * 4. Fuel detail inside a known aggregate scales by its class, keeping the national mix.
 *
 * Rows where the catalog has an exact local series (`getNationalGoalMappings`)
 * get the local-statistic method on top of what the rule here says. Point
 * sources (a plant is there or it isn't) get no honest scaler.
 *
 * Only the recipe *shape* lives here; `leapSuggestedRecipes` turns a rule into
 * suggested methods for an area. Every table selection below was checked
 * against the live APIs on 2026-09-11.
 */

/** A statistics series that can be read for an area: the fixed part of the selection, plus how the area goes in. */
export type ScalingSource = {
  dataset: DatasetKeys;
  tableId: string;
  selection: ApiSelectionItem[];
  region: CuratedRegion;
  /** Which area levels the table has rows for */
  levels: GeoAreaType[];
};

/** A denominator series read locally and nationally; the national one defaults to the same table at "00". */
export type ScalingDenominator = {
  /** What it measures, for the variable names (see the `leap_scaling.denominators` locale keys) */
  label: DenominatorLabel;
  local: ScalingSource;
  national?: ScalingSource;
};

export const DenominatorLabel = {
  PopulationForecast: "POPULATION_FORECAST",
  Population: "POPULATION",
  EnergyUseHouseholds: "ENERGY_USE_HOUSEHOLDS",
  EnergyUseServices: "ENERGY_USE_SERVICES",
  EnergyUseAgricultureForestry: "ENERGY_USE_AGRICULTURE_FORESTRY",
  EnergyUseIndustryConstruction: "ENERGY_USE_INDUSTRY_CONSTRUCTION",
  EnergyUseFuelClass: "ENERGY_USE_FUEL_CLASS",
  ElectricityProduction: "ELECTRICITY_PRODUCTION",
  ElectricityFuelClass: "ELECTRICITY_FUEL_CLASS",
  DistrictHeatingProduction: "DISTRICT_HEATING_PRODUCTION",
  DistrictHeatingFuelClass: "DISTRICT_HEATING_FUEL_CLASS",
  HeavyTrucks: "HEAVY_TRUCKS",
  LightTrucks: "LIGHT_TRUCKS",
  Buses: "BUSES",
  PassengerCars: "PASSENGER_CARS",
  DwellingArea: "DWELLING_AREA",
} as const;
export type DenominatorLabel = (typeof DenominatorLabel)[keyof typeof DenominatorLabel];

export const LeapScalingKind = {
  /** Rule 1: copied unchanged */
  Copy: "COPY",
  /** Rule 2: by population, per year with the forecasts */
  Population: "POPULATION",
  /** Rules 3 and 4: by the ratio of a local statistic to the national one */
  Ratio: "RATIO",
  /** A point source: no honest scaler, only "as is" or zero */
  Point: "POINT",
} as const;
export type LeapScalingKind = (typeof LeapScalingKind)[keyof typeof LeapScalingKind];

export type LeapScalingRule =
  | { kind: typeof LeapScalingKind.Copy }
  | { kind: typeof LeapScalingKind.Population, /** Only defensible under a consumption-based framing (rail, shipping) */ consumptionBased?: boolean }
  | { kind: typeof LeapScalingKind.Ratio, /** Summed when several */ denominators: ScalingDenominator[] }
  | { kind: typeof LeapScalingKind.Point };

const ALL_LEVELS = [GeoAreaType.NATION, GeoAreaType.COUNTY, GeoAreaType.MUNICIPALITY];
const SCB_REGION: CuratedRegion = { kind: CuratedRegionKind.PxWebCode, variableCode: "Region" };

function scb(tableId: string, selection: ApiSelectionItem[]): ScalingSource {
  return { dataset: "SCB", tableId, selection, region: SCB_REGION, levels: ALL_LEVELS };
}
function trafa(tableId: string, selection: ApiSelectionItem[]): ScalingSource {
  return { dataset: "Trafa", tableId, selection, region: { kind: CuratedRegionKind.Trafa }, levels: ALL_LEVELS };
}

/** SCB population forecast: TAB6299 per county and municipality (2022–2070), TAB6579 for the nation (2025–2120); sex and age eliminated to totals. */
export const populationForecast: ScalingDenominator = {
  label: DenominatorLabel.PopulationForecast,
  local: { ...scb("TAB6299", [{ variableCode: "ContentsCode", valueCodes: ["000006MS"] }]), levels: [GeoAreaType.COUNTY, GeoAreaType.MUNICIPALITY] },
  national: { dataset: "SCB", tableId: "TAB6579", selection: [{ variableCode: "ContentsCode", valueCodes: ["000007YG"] }], region: { kind: CuratedRegionKind.None }, levels: [GeoAreaType.NATION] },
};

/** SCB population at year end, 1991 onwards (the density table; both sexes). */
export const population: ScalingDenominator = {
  label: DenominatorLabel.Population,
  local: scb("TAB628", [{ variableCode: "Kon", valueCodes: ["1+2"] }, { variableCode: "ContentsCode", valueCodes: ["BE0101U2"] }]),
};

/** SCB municipal energy statistics, final use (MWh) per consumer category and fuel class. */
function energyUse(label: DenominatorLabel, category: string, fuelClass = "955"): ScalingDenominator {
  return {
    label,
    local: scb("TAB3654", [
      { variableCode: "Forbrukningskategri", valueCodes: [category] },
      { variableCode: "Bransle", valueCodes: [fuelClass] },
      { variableCode: "ContentsCode", valueCodes: ["EN0203AE"] },
    ]),
  };
}
/** SCB electricity production (MWh) per production type and fuel class. */
function electricity(label: DenominatorLabel, productionType: string, fuelClass = "17"): ScalingDenominator {
  return {
    label,
    local: scb("TAB3451", [
      { variableCode: "Produktionssatt", valueCodes: [productionType] },
      { variableCode: "Bransle", valueCodes: [fuelClass] },
      { variableCode: "ContentsCode", valueCodes: ["EN0203AD"] },
    ]),
  };
}
/** SCB district heating production (MWh) per production type and fuel class. */
function districtHeating(label: DenominatorLabel, productionType: string, fuelClass = "20"): ScalingDenominator {
  return {
    label,
    local: scb("TAB3452", [
      { variableCode: "Produktionssatt", valueCodes: [productionType] },
      { variableCode: "Bransle", valueCodes: [fuelClass] },
      { variableCode: "ContentsCode", valueCodes: ["EN0203AC"] },
    ]),
  };
}
/** Trafa vehicles in traffic at year end for one fuel code; trucks split by type (22 light, 23 heavy). */
function vehicles(label: DenominatorLabel, tableId: string, drivmedel: string, truckType?: string): ScalingDenominator {
  return {
    label,
    local: trafa(tableId, [
      { variableCode: "metric", valueCodes: ["itrfslut"] },
      ...(truckType ? [{ variableCode: "fslagh", valueCodes: [truckType] }] : []),
      { variableCode: "drivmedel", valueCodes: [drivmedel] },
    ]),
  };
}
/** SCB average dwelling area per person, all households and tenures. */
const dwellingArea: ScalingDenominator = {
  label: DenominatorLabel.DwellingArea,
  local: scb("TAB1541", [
    { variableCode: "Hushallstyp", valueCodes: ["SAMTLH"] },
    { variableCode: "Boendeform", valueCodes: ["TOT"] },
    { variableCode: "ContentsCode", valueCodes: ["HE0111DJ"] },
  ]),
};

// TAB3654 consumer categories per LEAP sector; a sector spanning two categories sums them
const sectorCategories: Record<string, string[]> = {
  "Hushåll": ["98", "97"],
  "Service": ["931", "951"],
  "Jordbruk": ["911"],
  "Skogsbruk": ["911"],
  "Byggverksamhet": ["921"],
};
const sectorLabels: Record<string, DenominatorLabel> = {
  "Hushåll": DenominatorLabel.EnergyUseHouseholds,
  "Service": DenominatorLabel.EnergyUseServices,
  "Jordbruk": DenominatorLabel.EnergyUseAgricultureForestry,
  "Skogsbruk": DenominatorLabel.EnergyUseAgricultureForestry,
  "Byggverksamhet": DenominatorLabel.EnergyUseIndustryConstruction,
};

/** The SCB fuel class (Bransle) a LEAP energy carrier or fuel falls in, or null when it has none. */
function fuelClass(fuel: string): string | null {
  const name = fuel.toLowerCase();
  if (/^el\b|^el till|^el exkl|elektricitet/.test(name)) return "16";
  if (/fjärrvärme/.test(name)) return "14";
  if (/eldningsolja|eo1|eo2|lättoljor|tjockolja/.test(name)) return "905";
  if (/gasol|naturgas|stadsgas|hyttgas|masugnsgas/.test(name)) return "915";
  if (/torv|^kol\b|^koks\b|fossilt avfall|avfall fossilt|övriga bränslen fossilt/.test(name)) return "910";
  if (/biogas/.test(name)) return "930";
  if (/bioolja|biooljor/.test(name)) return "920";
  if (/biobränsle|trädbränsle|biokol|avlutar|förnybart avfall|avfall förnybart|pellets|ved/.test(name)) return "925";
  return null;
}

const copy: LeapScalingRule = { kind: LeapScalingKind.Copy };
const point: LeapScalingRule = { kind: LeapScalingKind.Point };
const byPopulation: LeapScalingRule = { kind: LeapScalingKind.Population };
const ratio = (...denominators: ScalingDenominator[]): LeapScalingRule => ({ kind: LeapScalingKind.Ratio, denominators });

/** Rule 1: intensities, shares, policy flags and the like are copied unchanged. */
const INTENSITY_OR_SHARE = /per (kvadratmeter|m2|km|capita|fordon|flygavgång|flygenkelresa|fordonskm)|^kWh per km|^körsträcka per|andel|procent|^Fyra av tio|vektor$|^Miljözon|^Snabbare införande|strategi$|reseavdrag|Klimatdeklaration|Styrmedel|^Bilpool|bredband|differentiering|energiprocentandel/i;

/**
 * The scaling rule for a LEAP indicator parameter, or null when the doc has no
 * rule for it (the form then offers its usual methods).
 */
export function getLeapScalingRule(indicatorParameter: string): LeapScalingRule | null {
  const segments = indicatorParameter.split("\\").filter(Boolean);
  if (segments[0] === "Key") segments.shift();
  const [branch, ...rest] = segments;
  const leaf = segments.at(-1) ?? "";
  if (!branch) return null;

  if (branch === "Bränslen") return copy;
  if (branch === "Befolkning") return byPopulation;

  if (branch === "Bostäder och lokaler") {
    if (/Uppvärmd area per capita/.test(leaf) && rest[0] !== "Lokaler") return ratio(dwellingArea);
    return copy;
  }

  if (branch === "Landtransporter") {
    const [group, sub] = rest;
    if (INTENSITY_OR_SHARE.test(leaf)) return copy;
    if (group === "Personbilar") {
      if (leaf === "Antal bilar" && sub) return ratio(vehicles(DenominatorLabel.PassengerCars, "t10026", carFuel(sub) ?? "t1"));
      if (/Fordonskm/.test(leaf)) return ratio(vehicles(DenominatorLabel.PassengerCars, "t10026", "t1"));
      return copy;
    }
    if (group === "Lätta lastbilar") {
      const fuel = truckFuel(leaf);
      if (fuel) return ratio(vehicles(DenominatorLabel.LightTrucks, "t10023", fuel, "22"));
      if (/^antal lastbilar|fordonskm/.test(leaf)) return ratio(vehicles(DenominatorLabel.LightTrucks, "t10023", "t1", "22"));
      return copy;
    }
    if (group === "Tunga distributionslastbilar" || group === "Tunga fjärrlastbilar") {
      const fuel = truckFuel(leaf);
      if (fuel) return ratio(vehicles(DenominatorLabel.HeavyTrucks, "t10023", fuel, "23"));
      if (/fordonskm/.test(leaf)) return ratio(vehicles(DenominatorLabel.HeavyTrucks, "t10023", "t1", "23"));
      if (/bränslecell/.test(leaf)) return copy;
      return copy;
    }
    if (group === "Bussar") {
      const fuel = busFuel(leaf);
      if (fuel) return ratio(vehicles(DenominatorLabel.Buses, "t10021", fuel));
      if (/^körsträcka bussar$/.test(leaf)) return ratio(vehicles(DenominatorLabel.Buses, "t10021", "t1"));
      return copy;
    }
    if (group === "Bantrafik") {
      if (/Tågkm|Slutanvändning/.test(leaf)) return { kind: LeapScalingKind.Population, consumptionBased: true };
      return copy;
    }
    return null;
  }

  if (branch === "Luftfart") {
    if (INTENSITY_OR_SHARE.test(leaf)) return copy;
    if (/Fordonskm personresor|Bränsleanvändning/.test(leaf)) return byPopulation;
    if (/rör ej/.test(leaf)) return copy;
    return null;
  }

  if (branch === "Sjöfart") {
    if (INTENSITY_OR_SHARE.test(leaf)) return copy;
    if (/energibehov/i.test(leaf)) return { kind: LeapScalingKind.Population, consumptionBased: true };
    return null;
  }

  if (branch === "Energiomvandlingsanläggningar") {
    const [group] = rest;
    if (group === "Årlig elproduktion") {
      if (/Vattenkraft/.test(leaf)) return ratio(electricity(DenominatorLabel.ElectricityProduction, "4.1"));
      if (/Vindkraft/.test(leaf)) return ratio(electricity(DenominatorLabel.ElectricityProduction, "4.2"));
      if (/Solkraft/.test(leaf)) return ratio(electricity(DenominatorLabel.ElectricityProduction, "4.7"));
      if (/kraftvärme/i.test(leaf)) return ratio(electricity(DenominatorLabel.ElectricityProduction, "4.5+4.6"));
      if (/kärnkraft/i.test(leaf)) return point;
      return null;
    }
    if (group === "Årlig fjärrvärmeproduktion") return ratio(districtHeating(DenominatorLabel.DistrictHeatingProduction, "Totalt"));
    if (group === "Insatta bränslen för elproduktion") {
      if (/Kärnbränsle/.test(leaf)) return point;
      if (/^Summa/.test(leaf)) return ratio(electricity(DenominatorLabel.ElectricityFuelClass, "Totalt", "950"));
      const cls = fuelClass(leaf);
      return cls ? ratio(electricity(DenominatorLabel.ElectricityFuelClass, "Totalt", cls)) : null;
    }
    if (group === "Insatta bränslen för fjärrvärmeproduktion") {
      if (/^Summa/.test(leaf)) return ratio(districtHeating(DenominatorLabel.DistrictHeatingFuelClass, "Totalt", "950"));
      if (/^Elektricitet/.test(leaf)) return ratio(districtHeating(DenominatorLabel.DistrictHeatingProduction, "01"), districtHeating(DenominatorLabel.DistrictHeatingProduction, "4.6.1+4.7.1"));
      if (/^Spillvärme/.test(leaf)) return ratio(districtHeating(DenominatorLabel.DistrictHeatingProduction, "4.6.2+4.7.2"));
      const cls = fuelClass(leaf);
      return cls ? ratio(districtHeating(DenominatorLabel.DistrictHeatingFuelClass, "Totalt", cls)) : null;
    }
    if (/Biogent avfall/.test(leaf)) return copy;
    return null;
  }

  if (branch === "Industri") {
    if (/^CCS$/.test(leaf)) return point;
    const cls = fuelClass(leaf);
    // The local industry total is a fact; the branch mix inside it stays national
    return ratio(energyUse(cls ? DenominatorLabel.EnergyUseFuelClass : DenominatorLabel.EnergyUseIndustryConstruction, "921", cls ?? "955"));
  }

  if (branch === "Produktion av industrivaror" || /Processutsläpp/.test(indicatorParameter)) return point;

  if (branch === "Service") {
    const [group, sector] = rest;
    if (group === "Arbetsmaskiner") {
      if (sector === "Hushåll") return byPopulation;
      if (sector === "Fiske") return point;
      const categories = sectorCategories[sector ?? ""];
      if (!categories) return null;
      return ratio(...categories.map(category => energyUse(sectorLabels[sector ?? ""], category)));
    }
    if (group === "Stationär energianvändning") {
      if (sector === "Datacenter") return point;
      const categories = sectorCategories[sector ?? ""];
      if (!categories) return null;
      const cls = fuelClass(leaf);
      return ratio(...categories.map(category => energyUse(cls ? DenominatorLabel.EnergyUseFuelClass : sectorLabels[sector ?? ""], category, cls ?? "955")));
    }
    return null;
  }

  return null;
}

/** Trafa "drivmedel" code for a LEAP passenger car type ("Elbilar" → electric). */
function carFuel(type: string): string | null {
  if (/^Bensin/.test(type)) return "101";
  if (/^Diesel/.test(type)) return "102";
  if (/^Elbil/.test(type)) return "103";
  if (/^Laddhybrid/.test(type)) return "105";
  if (/^Etanol/.test(type)) return "106";
  if (/^Fordonsgas/.test(type)) return "107";
  return null;
}
/** Trafa "drivmedel" code for a LEAP truck count row ("diesellastbilar" → diesel); CNG and LNG share the gas code. */
function truckFuel(leaf: string): string | null {
  const match = /^(bensin|diesel|el|laddhybrid|etanol|fordonsgas|CNG|LNG|LNGgas)lastbilar$/i.exec(leaf);
  if (!match) return null;
  return ({ bensin: "101", diesel: "102", el: "103", laddhybrid: "105", etanol: "106", fordonsgas: "107", cng: "107", lng: "107", lnggas: "107" })[match[1].toLowerCase()] ?? null;
}
/** Trafa "drivmedel" code for a LEAP bus count row ("elbussar" → electric); fuel cells have no code. */
function busFuel(leaf: string): string | null {
  const match = /^(bensin|diesel|el|gas|etanol)bussar$/i.exec(leaf);
  if (!match) return null;
  return ({ bensin: "101", diesel: "102", el: "103", gas: "107", etanol: "106" })[match[1].toLowerCase()] ?? null;
}
