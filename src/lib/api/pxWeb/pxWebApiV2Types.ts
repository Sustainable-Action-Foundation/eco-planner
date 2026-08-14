// This file contains a number of types outlining the structure of the PxWeb API v2 responses.
// Based on actual responses from SCB's implementation of PxWeb API v2 at https://api.scb.se/ov0104/v2beta/api/v2/navigation,
// and the documentation at https://github.com/PxTools/PxApiSpecs/blob/master/PxAPI-2.yml.
// Our types might not reflect the full range of possible responses, or the actual types in pxWeb's implementation as they sometimes update their API.

// TODO: Check these types once PxWebAPIv2 gets a stable release; we unsafely cast responses from PxWeb to these types, which should be safe-ish as long as we keep our type defs up to date.

import type { JSONValue } from "@/types";
import type { ApiMetadataDimensionBase, ApiSelectOptionBase } from "../apiTypes";

// Compatibility types, compare to the types in trafaTypes.ts

export type PxWebCompatMetadataDimensionBase = ApiMetadataDimensionBase & {
  // Any additional or modified properties should be added here as necessary
}

export type PxWebCompatMetricDimension = Omit<PxWebCompatMetadataDimensionBase, "type"> & {
  type: "metric";
}

export type PxWebCompatTimeDimension = Omit<PxWebCompatMetadataDimensionBase, "type"> & {
  type: "time";
  optional: boolean;
}

export type PxWebCompatRegularDimension = Omit<PxWebCompatMetadataDimensionBase, "type"> & {
  type: "dimension";
  optional: boolean;
}

export type PxWebCompatDimensionValue = Omit<ApiSelectOptionBase, "type"> & {
  type: "dimensionValue";
  index: number;
  note?: string[];
  unit?: { base?: string; decimals?: number };
}


// Response from `/tables/{tableId}/data/`-endpoint, with outputFormat=json-stat2
export type PxWebTableContent = Omit<PxWebTableMetadata, "value"> & {
  /**
   * The size array contains the number of entries for each variable named in the `id` array.
   * We expect only one variable to have more than one entry in "valid" cases for our usage,
   * so we need to enforce this in code, asking the user to make a more specific selection if this is not the case.
   */
  size: number[];
  /**
   * Specifically when fetching data from the `/data/`-endpoint we expect the value array to NOT be empty,
   * as it should be a flattened array of all values in the table.
   * 
   * This value is ordered in row-major order, though we want it to essentially be "flat" from the start,
   * with only one dimension containing more than one value.
   */
  value: (number | null)[];
};

// Response from `/tables/`-endpoint
export type PxWebTableArray = {
  language: string; // ISO 639 language code
  tables: {
    type: "Table";
    id: string;
    label: string | null;
    description?: string | null;
    sortCode?: string;
    tags?: string[];
    updated: string | null; // ISO 8601 date string
    /** Possible format examples: "2024" | "2024K2" | "2024M5" | "2025W18" */
    firstPeriod: string | null;
    /** Possible format examples: "2024" | "2024K2" | "2024M5" | "2025W18" */
    lastPeriod: string | null;
    category?: "public" | "internal" | "private" | "section";
    variableNames: string[];
    discontinued?: boolean | null;
    source?: string;
    subjectCode?: string;
    timeUnit?: "Annual" | "Quarterly" | "Monthly" | "Weekly" | "Other";
    paths?: {
      id: string;
      label: string;
      sortCode?: string;
    }[];
    links: PxWebBasicLink[] | null;
  }[];
  page: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    links?: PxWebBasicLink[];
  };
  links?: PxWebBasicLink[];
};

// Response from `/tables/{tableId}/metadata`-endpoint
export type PxWebTableMetadata = {
  version: "2.0"; // Version of the API
  class: "dataset"; // "dataset"
  href?: string; // links back to itself
  label?: string;
  source?: string;
  updated?: string; // ISO 8601 date string
  link?: PxWebAdvancedLink;
  note?: string[];
  role: {
    time?: string[];
    geo?: string[];
    metric?: string[];
  };
  id: string[]; // Names/IDs for all dimensions (dimensionName below)
  size: number[]; // Number of entries for each variable named in id
  dimension: {
    [dimensionName: string]: PxWebStandardDimension | PxWebMetricDimension | PxWebTimeDimension | PxWebGeoDimension;
  };
  extension: {
    noteMandatory?: boolean[];
    px: {
      [key: string]: JSONValue; // This is probably not relevant for us, so I can't be bothered to write a type for it
    };
    firstPeriod?: string;
    lastPeriod?: string;
    tags?: string[];
    discontinued?: boolean | null;
    contact?: {
      name?: string;
      organization?: string;
      phone?: string;
      mail?: string;
      raw: string;
    }[];
  }
  /** Technically we expect this to return an empty number array, but this is basically the same ¯\_(ツ)_/¯ */
  value: never[];
  status?: { [key: string]: string; }
}

// Error response from most endpoints
export type PxWebErrorResponse = {
  type?: string;
  title?: string;
  status?: number; // HTTP status code, 100 <= status < 600
  detail?: string;
  instance?: string;
}

// Misc. utility types

export type PxWebUnit = {
  decimals?: number;
  base?: string;

  // following are defined in json-stat 2 spec, but not PxWeb 2 spec, so probably not relevant
  label?: string;
  symbol?: string;
  position?: "end" | "start";
}

export type PxWebNote = {
  mandatory?: boolean;
  text: string;
  conditions?: { variable: string; value: string; }[];
};

export type PxWebBasicLink = {
  rel: string;
  hreflang: string;
  href: string;
};

export type PxWebAdvancedLink = {
  related: {
    extension: {
      relation: string;
      category?: string | null;
      metaid: string;
    };
    href: string;
    label: string;
    type: string;
  }[];
};

export type PxWebStandardDimension = {
  label?: string;
  note?: string[];
  category: {
    // Index is required for any dimension with more than 1 value.
    // Dimensions with only 1 value MAY omit either the index or the label, but MUST contain at least one of them.
    index?: { [valueCode: string]: number };
    // If label is omitted, the valueCode/key for each index SHOULD be used as the label instead.
    label?: { [valueCode: string]: string };
    note?: { [valueCode: string]: string[] }; // Optional
    child: unknown; // It does stuff according to spec, but I can't be bothered to type or implement it yet
  };
  extension: {
    elimination: boolean | null; // Whether the variable is optional or not (true means it is optional)
    eliminationValueCode?: string; // Value code used as default when the variable is unset/eliminated. Never required.
    noteMandatory?: { [key: number]: boolean };
    categoryNoteMandatory?: { [variableValueId: string]: { [key: number]: boolean } };
    refperiod?: { [valueCode: string]: string; }; // A string describing the reference period for each value code. Cannot be reliably parsed into a date.
    show?: string; // "Information about how variables are presented" - according to spec
    codeLists?: {
      id: string;
      label: string;
      type: "Aggregation" | "Valueset";
      links: PxWebBasicLink[];
    }[];
    alternativeText?: { [valueCode: string]: string };
  };
  link?: PxWebAdvancedLink;
}

export type PxWebTimeDimension = PxWebStandardDimension & {
  // Same as standard dimension
  readonly _pxWebRole?: "time"; // Mark as separate type for clarity.
}

export type PxWebMetricDimension = PxWebStandardDimension & {
  category: {
    unit: { [valueCode: string]: PxWebUnit };
  };
  extension: {
    measuringType?: { [valueCode: string]: "Stock" | "Flow" | "Average" | "Other"; };
    priceType?: { [valueCode: string]: "NotApplicable" | "Current" | "Fixed"; };
    adjustment?: { [valueCode: string]: "None" | "SesOnly" | "WorkOnly" | "WorkAndSes"; };
    basePeriod?: { [valueCode: string]: string; };
  }
}

export type PxWebGeoDimension = PxWebStandardDimension & {
  coordinates?: {
    [valueCode: string]: [number, number]; // Longitude, Latitude
  }
}