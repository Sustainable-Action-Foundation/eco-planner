// This file contains a number of types outlining the structure of the PxWeb API v2 responses.
// Based on actual responses from SCB's implementation of PxWeb API v2 at https://api.scb.se/ov0104/v2beta/api/v2/navigation,
// and the documentation at https://github.com/PxTools/PxApiSpecs/blob/master/PxAPI-2.yml.
// Our types might not reflect the full range of possible responses, or the actual types in pxWeb's implementation as they sometimes update their API.

// TODO: Check these types once PxWebAPIv2 gets a stable release; we unsafely cast responses from PxWeb to these types, which should be safe-ish as long as we keep our type defs up to date.

import type { JSONValue } from "@/types";
import type { ApiDetailItemBase } from "../apiTypes";

// export type PxWebApiV2TableContentJsonStat2 = {

// };

// USED BY GETPXWEBTABLECONTENT
export type PxWebApiV2TableContentJsonPx = {
  columns: [{
    code: string; // Variable/dimension name/id
    text: string; // Label from the dimension/category
    type: "c" | "t" | "d" | "g"; // "d" for generic dimension, "t" for time dimension, "c" for metric dimension, probably "g" for geo dimension, but no examples found so far
  }];
  comments: unknown[];
  data: [{
    key: string[];
    values: string[];
  }];
  metadata: [{
    infofile?: string;
    updated: string; // ISO 8601 date string
    label: string;
    source: string;
  }];
};

// USED BY GETPXWEBTABLES
export type PxWebApiV2TableArray = {
  language: string; // ISO 639 language code
  tables: [{
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
    paths?: [{
      id: string;
      label: string;
      sortCode?: string;
    }];
    links: PxWebApiV2BasicLink[] | null;
  }];
  page: {
    pageNumber: number;
    pageSize: number;
    totalElements: number;
    totalPages: number;
    links?: PxWebApiV2BasicLink[];
  };
  links?: PxWebApiV2BasicLink[];
};

export type PxWebDetailItemBase = ApiDetailItemBase & {
  // Add additional properties for PxWeb here if necessary
}

export type PxWebMetric = PxWebDetailItemBase & {
  index: number;
  unit: { base: string; decimals: number };
}

export type PxWebVariable = PxWebDetailItemBase & {
  optional: boolean;
  option: boolean;
  elimination: boolean; // This is whether the variable is optional or not
  show: "value"; // TODO - What is this and what are the other possible values?
  categoryNoteMandatory?: { [variableValueId: string]: boolean[] }; // TODO - What is this for?
  values: PxWebVariableValue[];
}

export type PxWebVariableValue = PxWebDetailItemBase & {
  index: number;
  note?: string[];
}

export type PxWebTimeVariable = PxWebDetailItemBase & {
  optional: boolean;
  elimination: boolean; // This is whether the variable is optional or not
  show: "value"; // TODO - What is this and what are the other possible values?
}

export type PxWebApiV2Unit = {
  decimals?: number;
  base?: string;

  // following are defined in json-stat 2 spec, but not PxWeb 2 spec, so probably not relevant
  label?: string;
  symbol?: string;
  position?: "end" | "start";
}

export type PxWebApiV2Note = {
  mandatory?: boolean;
  text: string;
  conditions?: [{ variable: string; value: string; }];
};

export type PxWebApiV2BasicLink = {
  rel: string;
  hreflang: string;
  href: string;
};

export type PxWebApiV2AdvancedLink = {
  related: [{
    extension: {
      relation: string;
      category?: string | null;
      metaid: string;
    };
    href: string;
    label: string;
    type: string;
  }];
};;

export type PxWebApiV2VariableBase = {
  id: string;
  label: string;
  notes?: PxWebApiV2Note[];
  links?: PxWebApiV2BasicLink[];
};

export type PxWebApiV2TimeVariable = PxWebApiV2VariableBase & {
  type: "TimeVariable";
  elimination: undefined;
  timeUnit?: "Annual" | "Quarterly" | "Monthly" | "Weekly" | "Other";
  /** Possible format examples: "2024" | "2024K2" | "2024M5" | "2025W18" */
  firstPeriod?: string;
  /** Possible format examples: "2024" | "2024K2" | "2024M5" | "2025W18" */
  lastPeriod?: string;
  values: [
    {
      code: string;
      label: string;
      notes?: PxWebApiV2Note[];
      links?: PxWebApiV2BasicLink[];
    }
  ];
};

// NOT USED
export type PxWebApiV2ContentsVariable = PxWebApiV2VariableBase & {
  type: "ContentsVariable";
  elimination: undefined;
  values: [
    {
      code: string;
      label: string;
      unit: string;
      baseperiod?: string | null;
      adjustment?: "None" | "SesOnly" | "WorkOnly" | "WorkAndSes";
      measuringType?: "Stock" | "Flow" | "Average" | "Other";
      referencePeriod?: string;
      preferedNumberOfDecimals?: number;
      priceType?: "Undefined" | "Current" | "Fixed";
      notes?: PxWebApiV2Note[];
      links?: PxWebApiV2BasicLink[];
    }
  ];
};

// NOT USED
export type PxWebApiV2RegularVariable = PxWebApiV2VariableBase & {
  type: "RegularVariable";
  elimination?: boolean;
  eliminationValueCode?: string;
  values: [
    {
      code: string;
      label: string;
      notes?: PxWebApiV2Note[];
      links?: PxWebApiV2BasicLink[];
    }
  ];
  codeLists?: [
    {
      id: string;
      label: string;
      type: "Aggregation" | "Valueset";
      links: PxWebApiV2BasicLink[];
    }
  ];
};

// NOT USED
export type PxWebApiV2GeographicalVariable = PxWebApiV2VariableBase & {
  type: "GeographicalVariable";
  elimination?: boolean;
  eliminationValueCode?: string;
  map?: string;
  values: [
    {
      code: string;
      label: string;
      notes?: PxWebApiV2Note[];
      links?: PxWebApiV2BasicLink[];
    }
  ];
  codeLists?: [
    {
      id: string;
      label: string;
      type: "Aggregation" | "Valueset";
      links: PxWebApiV2BasicLink[];
    }
  ];
};

export type PxWebApiV2ErrorResponse = {
  type?: string;
  title?: string;
  status?: number; // HTTP status code, 100 <= status < 600
  detail?: string;
  instance?: string;
}

export type PxWebApiV2TableDetails = {
  version: "2.0"; // Version of the API
  class: "dataset"; // "dataset"
  href?: string; // links back to itself
  label?: string;
  source?: string;
  updated?: string; // ISO 8601 date string
  link?: PxWebApiV2AdvancedLink;
  note?: string[];
  role: {
    time?: string[];
    geo?: string[];
    metric?: string[];
  };
  id: string[]; // Names/IDs for all dimensions (dimensionName below)
  size: number[]; // Number of entries for each variable named in id
  dimension: {
    [dimensionName: string]: PxWebApiV2StandardDimension | PxWebApiV2MetricDimension | PxWebApiV2TimeDimension | PxWebApiV2GeoDimension;
  };
  extension: {
    noteMandatory?: boolean[];
    px: {
      [key: string]: JSONValue; // This is probably not relevant for us, so I can't be bothered to write a type for it
      stub: string[];
    };
    firstPeriod?: string;
    lastPeriod?: string;
    tags?: string[];
    discontinued?: boolean | null;
    contact?: [{
      name?: string;
      organization?: string;
      phone?: string;
      mail?: string;
      raw: string;
    }];
  }
  value: number[] | null;
  status?: { [key: string]: string; }
}

export type PxWebApiV2StandardDimension = {
  label?: string;
  note?: string[];
  category: {
    // Index is required for any dimension with more than 1 value.
    // Dimensions with only 1 value MAY omit either the index or the label, but MUST contain at least one of them.
    index?: { [valueCode: string]: number };
    // If label is omitted, the valueCode for each index SHOULD be used as the label instead.
    label?: { [valueCode: string]: string };
    note?: { [valueCode: string]: string[] }; // Optional
    child: unknown; // It does stuff according to spec, but I can't be bothered to type or implement it yet
  };
  extension: {
    elimination: boolean; // Whether the variable is optional or not (true means it is optional)
    eliminationValueCode?: string; // Value code used as default when the variable is unset/eliminated. Never required.
    noteMandatory?: { [key: number]: boolean };
    categoryNoteMandatory?: { [variableValueId: string]: { [key: number]: boolean } };
    refperiod?: { [valueCode: string]: string; }; // A string describing the reference period for each value code. Cannot be reliably parsed into a date.
    show?: string; // "Information about how variables are presented" - according to spec
    codeLists?: [
      {
        id: string;
        label: string;
        type: "Aggregation" | "Valueset";
        links: PxWebApiV2BasicLink[];
      }
    ];
    alternativeText?: { [valueCode: string]: string };
  };
  link?: PxWebApiV2AdvancedLink;
}

export type PxWebApiV2TimeDimension = PxWebApiV2StandardDimension & {
  // Same as standard dimension
}

export type PxWebApiV2MetricDimension = PxWebApiV2StandardDimension & {
  category: {
    unit: { [valueCode: string]: PxWebApiV2Unit };
  };
  extension: {
    measuringType?: { [valueCode: string]: "Stock" | "Flow" | "Average" | "Other"; };
    priceType?: { [valueCode: string]: "NotApplicable" | "Current" | "Fixed"; };
    adjustment?: { [valueCode: string]: "None" | "SesOnly" | "WorkOnly" | "WorkAndSes"; };
    basePeriod?: { [valueCode: string]: string; };
  }
}

export type PxWebApiV2GeoDimension = PxWebApiV2StandardDimension & {
  coordinates?: {
    [valueCode: string]: [number, number]; // Longitude, Latitude
  }
}