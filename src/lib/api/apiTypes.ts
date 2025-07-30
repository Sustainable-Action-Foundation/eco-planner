import { PxWebMetric, PxWebTimeVariable, PxWebVariable } from "../pxWeb/pxWebApiV2Types"
import { TrafaHierarchy, TrafaMetric, TrafaVariable } from "../trafa/trafaTypes"

export type ApiTableContent = {
  id: string,
  columns: {
    id: string,
    label: string,
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