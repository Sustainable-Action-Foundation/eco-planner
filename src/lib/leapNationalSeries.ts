import type { ApiSelectionItem, DatasetKeys } from "@/lib/api/apiTypes";

/*
 * The national statistic that measures a LEAP row of the seeded national
 * scenarios, in the row's own unit, for filling the goals' historical data
 * (scripts/prisma/fill-national-historical.ts). Rows the curated catalog
 * measures at every level (`getNationalGoalMappings`) are here too when the
 * national series needs a unit conversion the catalog doesn't carry. Only
 * direct matches: the same quantity in the same or a convertible unit, per
 * ignore/martin-mail/external-sources/leap-scaling-tables.md. Rows the
 * statistics define differently are left out on purpose, e.g. heat demand per
 * m² (LEAP counts the heat a heat pump lifts from the ground, the surveys count
 * bought energy) and every industry row (Energimyndigheten has no fuel by
 * branch).
 *
 * Every selection was read from the live APIs on 2026-09-12. The time
 * dimension is left out: the PxWeb layer adds every period, and Trafa always
 * queries all years. Energimyndigheten's year codes are positional in most
 * tables, which its metadata flags as the time role, so the layer copes.
 */

export type LeapNationalSource = {
  dataset: DatasetKeys;
  tableId: string;
  /** Dimension selection excluding time */
  selection: ApiSelectionItem[];
  /** The statistic's own unit */
  unit: string;
  /** Multiply the statistic by this to get the LEAP row's unit; 1 when they agree */
  scale: number;
};

/** TWh of annual energy as the average power in GW that LEAP labels "GW" (8760 h in a year) */
const TWH_TO_AVERAGE_GW = 1 / 8.76;
/** TJ → TWh */
const TJ_TO_TWH = 1 / 3600;

function stem(tableId: string, selection: Record<string, string>, unit: string, scale = 1): LeapNationalSource {
  return {
    dataset: "STEM",
    tableId,
    selection: Object.entries(selection).map(([variableCode, code]) => ({ variableCode, valueCodes: [code] })),
    unit,
    scale,
  };
}
function trafa(tableId: string, selection: Record<string, string>, unit: string, scale = 1): LeapNationalSource {
  return {
    dataset: "Trafa",
    tableId,
    selection: Object.entries(selection).map(([variableCode, code]) => ({ variableCode, valueCodes: [code] })),
    unit,
    scale,
  };
}

/** Energimyndigheten's "Energivara" codes shared by the construction (EN0114_A) and agriculture (EN0119_1) balance tables, per LEAP carrier. */
const balanceCarrierCodes: Record<string, string> = {
  "Fasta biobränslen": "2",
  "Biooljor": "13",
  "Biogas": "17",
  "EO1": "28",
  "EO2": "29",
  "Gasol": "23",
  "Naturgas": "32",
  "Stadsgas": "33",
  "Övriga bränslen": "35",
};

/** Trafa "drivmedel" codes per LEAP passenger car type and truck fuel prefix. */
const carTypes: Record<string, string> = { Bensinbilar: "101", Dieselbilar: "102", Elbilar: "103", Laddhybridbilar: "105", Etanolbilar: "106", Fordonsgasbilar: "107" };
const truckFuels: Record<string, string> = { bensin: "101", diesel: "102", el: "103", laddhybrid: "105", etanol: "106", fordonsgas: "107" };

/**
 * EN0202_25 net electricity production per kind of plant. Wind is split
 * land/sea in LEAP, which the statistic isn't. LEAP's solar roof/ground split
 * has no statistic either (EN0123_1 only splits by size class, TAB3451 has one
 * "solkraft" row), but LEAP's own base year carries the national total in both
 * solar rows — as does the curated catalog (`getNationalGoalMappings`) — so
 * both solar goals get the total, not a made-up split.
 */
const electricityKinds: Record<string, string> = {
  "Vattenkraft": "0",
  "Solkraft tak": "2",
  "Solkraft mark": "2",
  "Befintligt kärnkraft": "3",
  "Industriell kraftvärme": "4",
  "Kraftvärme": "5",
};

/** EN_IND5-4E fleet energy use per fuel category, kWh/100 km. Plug-in hybrids are split by engine fuel there and have no single row. */
const carFuelCategories: Record<string, string> = {
  "Bensinbilar": "0",
  "Dieselbilar": "1",
  "Etanolbilar": "2",
  "Fordonsgasbilar": "3",
  "Elbilar": "6",
};

/**
 * The national statistic for a LEAP indicator parameter, or null when the
 * doc has no direct match (or the curated catalog already covers the row).
 */
export function getLeapNationalSource(indicatorParameter: string): LeapNationalSource | null {
  const segments = indicatorParameter.split("\\").filter(Boolean);
  if (segments[0] === "Key") segments.shift();
  const [branch, ...rest] = segments;
  const leaf = segments.at(-1) ?? "";
  if (!branch) return null;

  if (branch === "Befolkning") {
    return { dataset: "SCB", tableId: "TAB628", selection: [
      { variableCode: "Region", valueCodes: ["00"] },
      { variableCode: "Kon", valueCodes: ["1+2"] },
      { variableCode: "ContentsCode", valueCodes: ["BE0101U2"] },
    ], unit: "personer", scale: 1 };
  }

  if (branch === "Bostäder och lokaler") {
    // Electricity for other purposes than heating and hot water per m², non-residential premises
    if (rest[0] === "Lokaler" && leaf === "Driftel per m2") return stem("EN_IND10C", { CONTENTS: "content", "Mått": "2" }, "kWh/m2");
    return null;
  }

  if (branch === "Landtransporter") {
    const [group, sub] = rest;
    if (group === "Personbilar") {
      if (leaf === "Antal bilar" && sub && carTypes[sub]) return trafa("t10026", { metric: "itrfslut", drivmedel: carTypes[sub] }, "antal");
      if (leaf === "kWh per km" && sub && carFuelCategories[sub]) return stem("EN_IND5-4E", { Drivmedelskategori: carFuelCategories[sub] }, "kWh/100 km", 0.01);
      if (leaf === "Fordonskm") return trafa("t04010", { metric: "fordonkm", fslag: "10" }, "miljoner km", 1e6);
      return null;
    }
    if (group === "Lätta lastbilar") {
      const fuel = /^(bensin|diesel|el|laddhybrid|etanol|fordonsgas)lastbilar$/.exec(leaf)?.[1];
      if (fuel) return trafa("t10023", { metric: "itrfslut", fslagh: "22", drivmedel: truckFuels[fuel] }, "antal");
      if (leaf === "fordonskm lastbilar") return trafa("t04010", { metric: "fordonkm", fslag: "21" }, "miljoner km", 1e6);
      if (leaf === "antal lastbilar") return trafa("t10023", { metric: "itrfslut", fslagh: "22", drivmedel: "t1" }, "antal");
      return null;
    }
    return null;
  }

  // Transport sector energy use by mode, in TJ (the TWh unit of the table is rounded to whole TWh)
  const transportEnergy = (sektor: string) => stem("EN0118_3", { CONTENTS: "content", Enhet: "1", Bransleslag: "22", Sektor: sektor }, "TJ", TJ_TO_TWH);
  if (branch === "Luftfart") {
    if (leaf === "Bränsleanvändning inrikes flyg") return transportEnergy("6");
    if (leaf === "Bränsleanvändning utrikes flyg") return transportEnergy("7");
    return null;
  }
  if (branch === "Sjöfart") {
    if (leaf === "Inrikes sjöfart energibehov") return transportEnergy("3");
    if (leaf === "Utrikes sjöfart energibehov") return transportEnergy("4");
    return null;
  }

  if (branch === "Energiomvandlingsanläggningar") {
    const [group] = rest;
    if (group === "Årlig elproduktion") {
      return electricityKinds[leaf] ? stem("EN0202_25", { CONTENTS: "content", Kraftslag: electricityKinds[leaf] }, "TWh", TWH_TO_AVERAGE_GW) : null;
    }
    if (group === "Insatta bränslen för elproduktion") {
      // "Biobränslen" is left out: the statistic counts waste as biofuel, LEAP has waste rows of its own
      if (leaf === "Summa exkl kärnbränsle") return stem("EN0202_26", { CONTENTS: "content", Energivara: "5" }, "TWh");
      if (leaf === "Naturgas") return stem("EN0202_26", { CONTENTS: "content", Energivara: "3" }, "TWh");
      if (leaf === "Kol") return stem("EN0202_26", { CONTENTS: "content", Energivara: "1" }, "TWh");
      return null;
    }
    if (group === "Insatta bränslen för fjärrvärmeproduktion") {
      if (leaf === "Summa bränslen") return stem("EN0202_27", { CONTENTS: "content", Typ: "8" }, "TWh");
      if (leaf === "Spillvärme och uppgraderad värme") return stem("EN0202_27", { CONTENTS: "content", Typ: "7" }, "TWh");
      if (leaf === "Naturgas") return stem("EN0202_27", { CONTENTS: "content", Typ: "3" }, "TWh");
      if (leaf === "Kol") return stem("EN0202_27", { CONTENTS: "content", Typ: "1" }, "TWh");
      return null;
    }
    return null;
  }

  if (branch === "Service" && rest[0] === "Stationär energianvändning") {
    const sector = rest[1];
    // Electricity is left out: the balances have one electricity row, LEAP splits heating from other use
    const carrier = balanceCarrierCodes[leaf];
    if (!carrier) return null;
    if (sector === "Byggverksamhet") return stem("EN0114_A", { CONTENTS: "content", Balansrad: "0", Energivara: carrier, Enhet: "0" }, "GWh");
    if (sector === "Jordbruk") return stem("EN0119_1", { CONTENTS: "content", Balansrad: "0", Energivara: carrier, Enhet: "0" }, "GWh");
    if (sector === "Skogsbruk" && leaf === "EO1") return stem("EN0116_2", { CONTENTS: "content", Energivara: "2", Enhet: "1" }, "MWh", 0.001);
    return null;
  }

  return null;
}
