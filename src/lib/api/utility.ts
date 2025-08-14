export type DatasetKeys = "SCB" | "Trafa" | "SSB";
export type DatasetData = {
  baseUrl: string,
  userFacingUrl: string,
  supportedLanguages: string[],
  api: "PxWeb" | "Trafa",
  fullName?: string,
  alternateNames?: string[]
};

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
    baseUrl: "https://api.scb.se/ov0104/v2beta/api/v2/",
    userFacingUrl: "https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/",
    supportedLanguages: ["sv", "en"],
    api: "PxWeb",
    fullName: "Statistiska centralbyrån",
    alternateNames: ["scb", "statistics sweden"]
  };
  static scb = this.SCB;

  /** An API provided by Norwegian SSB, using the PxWeb API v2 */
  static SSB: DatasetData = {
    baseUrl: "https://data.ssb.no/api/pxwebapi/v2-beta/",
    userFacingUrl: "https://www.ssb.no/statbank/",
    supportedLanguages: ["no", "en"],
    api: "PxWeb",
    fullName: "Statistisk sentralbyrå",
    alternateNames: ["statistisk sentralbyrå", "statistics norway"]
  };
  static ssb = this.SSB;


  // Trafa-based APIs
  /** An API provided by Swedish Trafikanalys, with their own data format */
  static Trafa: DatasetData = {
    baseUrl: "https://api.trafa.se/api/",
    userFacingUrl: "https://www.trafa.se/sidor/statistikportalen/",
    supportedLanguages: ["sv"],
    api: "Trafa",
    fullName: "Trafikanalys",
    alternateNames: ["trafa"]
  };
  static trafa = this.Trafa;


  // Utility methods and properties
  /** A list of dataset keys with "canonical" casing. Should match the main keys of the class and be safe to use everywhere */
  static knownDatasetKeys: DatasetKeys[] = ["SCB", "SSB", "Trafa"];

  /**
   * Returns a list of datasets using the specified API(s).
   */
  static getDatasetsByApi(apiName: DatasetData["api"] | (DatasetData["api"])[]): DatasetKeys[] {
    if (typeof apiName === "string") {
      const entries = Object.entries(this)
        .filter(([, value]) => typeof value === "object" && "api" in value && value.api === apiName)
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
        if (!("fullName" in value) || !("alternateNames" in value)) {
          return undefined;
        }
        return [key.toLowerCase(), [key, value.fullName, ...(value.alternateNames || [])].map(alias => alias.toLowerCase())];
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

export function parsePeriod(period: string) {
  period = period.trim().toUpperCase();
  // If period is a quarter (kvartal)
  if (period.includes("Q") || period.includes("K")) {
    // Return a date based on year and first month of the quarter
    return new Date(Date.UTC(parseInt(period.split(/[QK]/)[0]), (parseInt(period.split(/[QK]/)[1]) - 1) * 3));
  }
  // If period is a month (månad)
  else if (period.includes("M")) {
    // Return a date based on year and month
    return new Date(Date.UTC(parseInt(period.split("M")[0]), parseInt(period.split("M")[1]) - 1));
  }
  // If period is a week (vecka)
  else if (period.includes("W") || period.includes("V")) {
    // Return a date based on year and first day of ISO week
    // Why can't JS natively parse all ISO 8601 strings ;^;
    const year = parseInt(period.split(/[WV]/)[0]);
    const week = parseInt(period.split(/[WV]/)[1]);
    const date = new Date(Date.UTC(year, 0, 1));
    // The first week of the year always contains the 4th of January
    // This allows us to calculate an offset between the first day of the year and the first day of the first week
    const dayOffset = new Date(Date.UTC(year, 0, 4)).getDay() + 3;
    // If Jan 1 is a Sunday, we'll see this returning 1 + 7 - 10 = -2 for week 1, meaning that the first week starts Dec 29 previous year
    // If Jan 1 is a Monday, we'll see this returning 1 + 7 - 4 = 4 for week 1, meaning that the first week starts Jan 4
    date.setDate(1 + (week) * 7 - dayOffset);
    return date;
  }
  // If none of the above match, assume it's a year and try to parse it as such (might return an invalid date)
  else {
    return new Date(Date.UTC(parseInt(period), 0));
  }
}