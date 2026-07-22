import type { PxWebCompatMetricDimension, PxWebCompatTimeDimension, PxWebCompatRegularDimension } from "./pxWeb/pxWebApiV2Types";
import type { TrafaCompatHierarchy, TrafaCompatMetricDimension, TrafaCompatRegularDimension, TrafaCompatTimeDimension } from "./trafa/trafaTypes";

/** The external datasets we know how to talk to. */
export type DatasetKeys = "SCB" | "Trafa" | "SSB" | "STEM";

/** How to reach a single external dataset; see `ExternalDataset` in `./utility` for the instances. */
export type DatasetData = {
  baseUrl: string,
  userFacingUrl: string,
  supportedLanguages: string[],
  api: "PxWeb" | "Trafa",
  fullName?: string,
  alternateNames?: string[]
};

// TODO: See if we can include any unit returned by external APIs
export type ApiTableContent = {
  id: string;
  values: {
    period: string;
    value: string;
  }[];
  metadata: {
    label?: string;
    source?: string;
  }[];
  unit?: {
    base?: string;
    decimals?: number;
  }
}

/** Might require processing before being sent to some external APIs, but works for PxWeb-based APIs as-is */
export type ApiSelectionItem = {
  variableCode: string;
  valueCodes: string[];
}

export type TrafaCompatTableMetadata = {
  tableId: string;
  metricDimensions: TrafaCompatMetricDimension[];
  timeDimensions: TrafaCompatTimeDimension[];
  regularDimensions: TrafaCompatRegularDimension[];
  hierarchies: TrafaCompatHierarchy[];
  language: string;
  api: "Trafa";
}

export type PxWebCompatTableMetadata = {
  tableId: string;
  metricDimensions: PxWebCompatMetricDimension[];
  timeDimensions: PxWebCompatTimeDimension[];
  // Any PxWeb geo dimensions are bundled together with regular dimensions for now.
  // Consider updating if we see a need for it, as well as proof of their existence :)
  regularDimensions: PxWebCompatRegularDimension[];
  hierarchies?: never;
  language: string;
  api: "PxWeb";
}

export type ApiTableMetadata = TrafaCompatTableMetadata | PxWebCompatTableMetadata;

export type ApiMetadataDimensionBase = {
  type: "metric" | "time" | "dimension";
  /** The value used to refer to a dimension when querying an API. Not necessarily the `id` property of the dimension in question; both trafa and PxWeb use a name-like property for this. */
  id: string;
  /** `name` is usually an internal, non-localized name used by the external API; if present, prefer using `label` for user-facing text */
  name: string;
  /** usually a localized string used as display name; prefer this for any user-facing text, but fall back to `name` if not present */
  label?: string;
  optional?: boolean | null;
  options: ApiSelectOptionBase[];
}

export type AnyApiMetadataDimension = TrafaCompatMetricDimension | TrafaCompatTimeDimension | TrafaCompatRegularDimension | PxWebCompatMetricDimension | PxWebCompatTimeDimension | PxWebCompatRegularDimension;

export type ApiHierarchyBase = {
  type: "hierarchy";
  id: string;
  name: string;
  label?: string;
  children: ApiMetadataDimensionBase[];
}

export type ApiSelectOptionBase = {
  type: "dimensionValue" | "filter";
  label?: string;
  value: string;
}