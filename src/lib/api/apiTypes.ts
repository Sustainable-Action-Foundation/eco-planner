import type { PxWebCompatMetricDimension, PxWebCompatTimeDimension, PxWebCompatRegularDimension } from "./pxWeb/pxWebApiV2Types";
import type { TrafaCompatHierarchy, TrafaCompatMetricDimension, TrafaCompatDimension } from "./trafa/trafaTypes";

// TODO: See if we can include any unit returned by external APIs
export type ApiTableData = {
  id: string,
  values: {
    period: string,
    value: string,
  }[],
  metadata: {
    label: string,
    source: string,
  }[]
}

export type ApiTableMetadata = {
  id: string,
  metrics: (TrafaCompatMetricDimension | PxWebCompatMetricDimension)[],
  hierarchies?: (TrafaCompatHierarchy)[],
  times: (TrafaCompatDimension | PxWebCompatTimeDimension)[],
  variables: (TrafaCompatDimension | PxWebCompatRegularDimension)[],
  language?: string,
}

export type ApiMetadataDimensionBase = {
  type: string,
  id: string,
  name: string,
  label: string,
}