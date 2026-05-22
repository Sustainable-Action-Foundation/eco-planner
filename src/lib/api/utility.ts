import { isStandardObject } from "@/types";
import type { ApiTableContent } from "./apiTypes";

// TODO: Refactor file

export type DatasetKeys = "SCB" | "Trafa" | "SSB" | "STEM";
export type DatasetData = {
  baseUrl: string,
  userFacingUrl: string,
  supportedLanguages: string[],
  api: "PxWeb" | "Trafa",
  fullName?: string,
  alternateNames?: string[]
};

export function isDataSetKeys(value: unknown): value is DatasetKeys {
  return typeof value === "string" && ExternalDataset.knownDatasetKeys.includes(value as DatasetKeys);
}

/**
 * # **DOCSTRING OUTDATED**
 * 
 * Key-value pairs of of external datasets.
 * @param key The key is the name of the dataset, e.g. "SCB" or "Trafa".
 * @param baseUrl The base URL points to the base of the API, without a trailing slash, e.g. "https://api.scb.se/ov0104/v2beta/api/v2".
 * To fetch any data, an additional path must be appended to the end, for example "/navigation", "/tables" or "/tables/{tableId}/data".
 * @param userFacingUrl User facing URL is the link to the website where the user will be directed when clicking the link declaring where historical data is fetched from.
 * @param supportedLanguages Supported languages is a list of languages that each dataset supports. First language in the list will be used as a fallback if the user's preferred language is not supported.
 * @param api Api is which api the dataset is using.
 * @param fullName Full name is the full name of the dataset as the key will usually be a shorthand for the full name.
 */
export class ExternalDataset {
  // PxWeb-based APIs
  /** An API provided by Swedish SCB, using the PxWeb API v2 */
  static SCB: DatasetData = {
    baseUrl: "https://statistikdatabasen.scb.se/api/v2/",
    userFacingUrl: "https://www.statistikdatabasen.scb.se/",
    supportedLanguages: ["sv", "en"],
    api: "PxWeb",
    fullName: "Statistiska centralbyrån",
    alternateNames: ["scb", "statistics sweden"],
  };
  static scb = this.SCB;

  /** An API provided by Norwegian SSB, using the PxWeb API v2 */
  static SSB: DatasetData = {
    baseUrl: "https://data.ssb.no/api/pxwebapi/v2/",
    userFacingUrl: "https://www.ssb.no/statbank2/",
    supportedLanguages: ["no", "en"],
    api: "PxWeb",
    fullName: "Statistisk sentralbyrå",
    alternateNames: ["statistisk sentralbyrå", "statistics norway"],
  };
  static ssb = this.SSB;

  /** An API provided by Swedish Energimyndigheten, using th PxWeb API v2 */
  static STEM: DatasetData = {
    baseUrl: "https://api.pxexternal2.energimyndigheten.se/",
    userFacingUrl: "https://pxexternal.energimyndigheten.se/pxweb/",
    supportedLanguages: ["sv"/*, "en"*/], // English support is currently (2026-05-22) very spotty from their side, so we won't list it as supported until it's more reliable
    api: "PxWeb",
    fullName: "Energimyndigheten",
    alternateNames: ["energimyndigheten", "swedish energy agency", "statens energimyndighet"],
  };
  static stem = this.STEM;


  // Trafa-based APIs
  /** An API provided by Swedish Trafikanalys, with their own data format */
  static Trafa: DatasetData = {
    baseUrl: "https://api.trafa.se/api/",
    userFacingUrl: "https://www.trafa.se/sidor/statistikportalen/",
    supportedLanguages: ["sv"],
    api: "Trafa",
    fullName: "Trafikanalys",
    alternateNames: ["trafa"],
  };
  static trafa = this.Trafa;


  // Utility methods and properties
  /** A list of dataset keys with "canonical" casing. Should match the main keys of the class and be safe to use everywhere */
  static knownDatasetKeys: DatasetKeys[] = ["SCB", "SSB", "Trafa", "STEM"];

  /**
   * Returns a list of datasets using the specified API(s).
   */
  static getDatasetsByApi(apiName: DatasetData["api"] | (DatasetData["api"])[]): DatasetKeys[] {
    if (typeof apiName === "string") {
      const entries = Object.entries(this)
        .filter(([, value]) => typeof value === "object" && "api" in value && (value as DatasetData).api === apiName)
        .filter(([key]) => this.knownDatasetKeys.includes(key as DatasetKeys));

      return entries.map(([key]) => key as DatasetKeys);
    } else if (Array.isArray(apiName)) {
      const datasets: DatasetKeys[] = [];
      for (const api of apiName) {
        const keys = this.getDatasetsByApi(api);
        if (keys) {
          datasets.push(...keys);
        }
      }
      return datasets.filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    } else {
      return [];
    }
  }

  /**
   * Searches for a dataset by any of its alternate names, full name, or key,
   * and returns the dataset data if found.
   */
  static getDatasetByAlternateName(alternateName: string): DatasetData | null {
    if (!alternateName || typeof alternateName !== "string") {
      return null;
    }

    if (alternateName in ExternalDataset) {
      const dataset = ExternalDataset[alternateName as keyof typeof ExternalDataset];
      if (dataset && typeof dataset === "object" && "baseUrl" in dataset) {
        return dataset;
      } else {
        return null;
      }
    }

    const lowerAlternateName = alternateName.toLowerCase();
    if (lowerAlternateName in ExternalDataset) {
      const dataset = ExternalDataset[lowerAlternateName as keyof typeof ExternalDataset];
      if (dataset && typeof dataset === "object" && "baseUrl" in dataset) {
        return dataset;
      } else {
        return null;
      }
    }

    const entries: [string, string[]][] = Object.entries(ExternalDataset)
      .map(([key, value]) => {
        if (!((o: unknown): o is DatasetData => {
          return isStandardObject(o) && "fullName" in o && "alternateNames" in o;
        })(value)) {
          return undefined; // Skip if value is not a DatasetData object
        }
        return [key.toLowerCase(), [key, value.fullName, ...(value.alternateNames ?? [])].map(alias => alias?.toLowerCase())];
      })
      .filter(Boolean) as [string, string[]][];

    const datasetName: string | null = entries.find(([, aliases]) => aliases.includes(lowerAlternateName))?.[0] ?? null;

    if (!datasetName || !(datasetName in ExternalDataset)) {
      return null;
    }

    const dataset = ExternalDataset[datasetName as keyof typeof ExternalDataset];
    if (dataset && typeof dataset === "object" && "baseUrl" in dataset) {
      return dataset;
    } else {
      return null;
    }
  }
}

export function parsePeriod(period: string): Date {
  period = period.trim().toUpperCase();

  const quarterDividers = ["Q", "K"];
  const monthDividers = ["M"];
  const weekDividers = ["W", "V"];

  // If period is a quarter (kvartal)
  const hasQuarterDivider = quarterDividers.find(divider => period.includes(divider));
  if (hasQuarterDivider) {
    const parts = period.split(hasQuarterDivider);
    return new Date(Date.UTC(
      parseInt(parts[0], 10), // Year
      (parseInt(parts[1], 10) - 1) * 3), // Month (0-indexed, so subtract 1 and multiply by 3 to align to quarters)
    );
  }

  // If period is a month (månad)
  const hasMonthDivider = monthDividers.find(divider => period.includes(divider));
  if (hasMonthDivider) {
    const parts = period.split(hasMonthDivider);
    return new Date(Date.UTC(
      parseInt(parts[0], 10), // Year
      parseInt(parts[1], 10) - 1), // Month (0-indexed, so subtract 1)
    );
  }

  // If period is a week (vecka)
  const hasWeekDivider = weekDividers.find(divider => period.includes(divider));
  if (hasWeekDivider) {
    const parts = period.split(hasWeekDivider);

    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);

    // The first week of the year always contains the 4th of January
    // This allows us to calculate an offset between the first day of the year and the first day of the first week
    const dayOffset = new Date(Date.UTC(year, 0, 4)).getUTCDay() + 3;

    // If Jan 1 is a Sunday, we'll see this returning 1 + 7 - 10 = -2 for week 1, meaning that the first week starts Dec 29 previous year
    // If Jan 1 is a Monday, we'll see this returning 1 + 7 - 4 = 4 for week 1, meaning that the first week starts Jan 4
    const date = new Date(Date.UTC(year, 0, 1));
    date.setUTCDate(1 + (week) * 7 - dayOffset);
    return date;
  }

  // If none of the above match, assume it's a year and try to parse it as such (might return an invalid date)
  // TODO: do explicit throwing or return null on invalid date? this seems like a recipe for downstream bugs
  console.warn(`parsePeriod: assuming period "${period}" is a year.`);
  return new Date(Date.UTC(parseInt(period, 10), 0));
}

/** 
 * Since there can be multiple readings a year, this picks the first reading for each year, no more.
 */
export function filterToInitialYearlyRecords(periodValuePairs: ApiTableContent["values"]): ApiTableContent["values"] {
  const filteredValues: ApiTableContent["values"] = [];
  const seenYears: Set<number> = new Set();

  for (const entry of periodValuePairs) {
    const date = parsePeriod(entry.period);
    const year = date.getUTCFullYear();

    if (!seenYears.has(year)) {
      seenYears.add(year);
      filteredValues.push(entry);
    }
  }

  return filteredValues;
}