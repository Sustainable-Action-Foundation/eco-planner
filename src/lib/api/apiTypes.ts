import { PxWebMetric, PxWebTimeVariable, PxWebVariable } from "../pxWeb/pxWebApiV2Types"
import { TrafaHierarchy, TrafaMetric, TrafaVariable } from "../trafa/trafaTypes"

export type OldApiTableContent = {
  id: string,
  columns: {
    id: string,
    label: string,
    /**
     * "d" for dimension, "m" for measure, "t" for time
     */
    type: "d" | "m" | "t",
  }[],
  data: {
    key: { columnId: string, value: string }[],
    values: (string)[],
  }[],
  metadata: {
    label: string,
    source: string,
  }[],
}

export type ApiTableContent = {
  id: string,
  values: {
    period: string,
    value: string,
  }[],
  timeColumnId?: string,
  timeColumnName?: string,
  dataColumnId?: string,
  dataColumnName?: string,
  /** "c" for content (PxWeb), "m" for measure (Trafa) ("c" and "m" are mostly interchangeable), "d" for dimension (Trafa) */
  dataColumnType?: ("c" | "m") | "d",
  metadata: {
    label: string,
    source: string,
  }[],
}

export type ApiTableDetails = {
  id: string,
  metrics: (TrafaMetric | PxWebMetric)[],
  hierarchies?: (TrafaHierarchy)[],
  variables: (TrafaVariable | PxWebVariable)[],
  times: (TrafaVariable | PxWebTimeVariable)[],
  language?: string,
}

export type ApiDetailItemBase = {
  type: string,
  id: string,
  name: string,
  label: string,
}