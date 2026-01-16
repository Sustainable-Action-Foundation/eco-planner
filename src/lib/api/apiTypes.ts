import { PxWebMetric, PxWebTimeVariable, PxWebVariable } from "../pxWeb/pxWebApiV2Types"
import { TrafaHierarchy, TrafaMetric, TrafaVariable } from "../trafa/trafaTypes"

// TODO: See if we can include any unit returned by external APIs
export type ApiTableContent = {
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