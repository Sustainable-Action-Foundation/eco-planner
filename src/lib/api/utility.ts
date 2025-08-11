export type DatasetKeys = "SCB" | "Trafa" | "SSB";
export type DatasetData = {
  baseUrl: string,
  userFacingUrl: string,
  supportedLanguages: string[],
  api: string,
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
class ExternalDatasetClass {
  // PXWeb-based APIs
  static SCB: DatasetData = {
    baseUrl: "https://api.scb.se/ov0104/v2beta/api/v2/",
    userFacingUrl: "https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/",
    supportedLanguages: ["sv", "en"],
    api: "PxWeb",
    fullName: "Statistiska centralbyrån",
    alternateNames: ["scb", "statistics sweden"]
  };
  static scb = this.SCB;

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
  static Trafa: DatasetData = {
    baseUrl: "https://api.trafa.se/api/",
    userFacingUrl: "https://www.trafa.se/sidor/statistikportalen/",
    supportedLanguages: ["sv"],
    api: "Trafa",
    fullName: "Trafikanalys",
    alternateNames: ["trafa"]
  };
  static trafa = this.Trafa;
}

export const ExternalDataset = new Proxy(ExternalDatasetClass, {
  get(target, prop) {

    if (prop in target) {
      return target[prop as keyof typeof target];
    }

    const lowerProp = prop.toString().toLowerCase();
    if (lowerProp in target) {
      return target[lowerProp as keyof typeof target];
    }

    const entries: [string, string[]][] = Object.entries(target)
      .map(([key, value]) => {
        if (!("fullName" in value) || !("alternateNames" in value)) {
          return undefined;
        }
        return [key.toLowerCase(), [key, value.fullName, ...(value.alternateNames || [])].map(alias => alias.toLowerCase())];
      })
      .filter(Boolean) as [string, string[]][];

    const datasetName: string | null = entries.find(([, aliases]) => aliases.includes(lowerProp))?.[0] ?? null;

    if (!datasetName || !(datasetName in target)) {
      return undefined;
    }

    return target[datasetName as keyof typeof target];
  },
});

console.log(Object.keys(ExternalDataset));

/**
 * @param apiNames a string or an array of strings that represent the api(s) to filter by
 * @returns list of datasets that use specified api(s)
 */
// export function getDatasetKeysOfApis(apiNames: string | string[]): string[] { return typeof apiNames == "string" ? Object.keys(externalDatasets).filter(key => externalDatasets[key]?.api === apiNames) : Object.keys(externalDatasets).filter(key => apiNames.includes(externalDatasets[key]?.api as string)); }

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

// export function getDatasetKeyFromAlternateName(name: string): string | null {
//   name = name.toLowerCase().trim();
//   // Check if the name matches any of the dataset alternate names
//   for (const key in externalDatasets) {
//     if (externalDatasets[key]?.alternateNames?.includes(name)) {
//       return key;
//     }
//   }
//   // If no match is found, return null
//   return null;
// }