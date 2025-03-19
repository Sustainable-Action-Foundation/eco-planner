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
  hierarchies: (TrafaHierarchy)[],
  variables: (TrafaVariable | PxWebVariable)[],
  times: (TrafaVariable | PxWebTimeVariable)[],
  language: string,
}

export type ApiDetailItemBase = {
  type: string,
  id: string,
  name: string,
  label: string,
}

export type PxWebDetailItemBase = ApiDetailItemBase & {
  // Add additional properties for scb (maybe it should be called pxweb) here if necessary
}

export type PxWebMetric = PxWebDetailItemBase & {
  index: number,
  unit: { base: string, decimals: number },
}

export type PxWebVariable = PxWebDetailItemBase & {
  optional: boolean,
  option: boolean,
  elimination: boolean, // This is whether the variable is required or not
  show: "value", // TODO - What is this and what are the other possible values?
  categoryNoteMandatory?: { [variableValueId: string]: { [arrayIndex: string]: boolean } }, // TODO - What is this for?
  values: PxWebVariableValue[],
}

export type PxWebVariableValue = PxWebDetailItemBase & {
  index: number,
  note?: string[],
}

export type PxWebTimeVariable = PxWebDetailItemBase & {
  elimination: boolean, // This is whether the variable is required or not
  show: "value", // TODO - What is this and what are the other possible values?
}

// TODO - which types actually use description?
export type TrafaDetailItemBase = ApiDetailItemBase & {
  trafaId: number,
  parentName: string | null,
  selected: boolean, // TODO - What is this for?
  option: boolean, // This indicates whether the item should be displayed or not
  description: string,
}

export type TrafaMetric = TrafaDetailItemBase & { // Marked as "M"
  dataType: "String",
}

export type TrafaHierarchy = TrafaDetailItemBase & { // Marked as "H"
  dataType: "String" | "Region",
  children?: TrafaVariable[],
}

export type TrafaVariable = TrafaDetailItemBase & { // Marked as "D"
  dataType: "String" | "Time" | "Region",
  optional: boolean,
  values?: (TrafaVariable | TrafaVariableValue | TrafaFilter)[], // "Variable" children are not found in structure items array, they are found by marking another "Variable" as parent. This is not always the case when there are multiple variables under a hierarchy, but sometimes. Does not seem connected to how many variables are under a hierarchy.
}

export type TrafaVariableValue = TrafaDetailItemBase & { // Marked as "DV"
  dataType: "String",
}

export type TrafaFilter = TrafaDetailItemBase & { // Marked as "F"
  dataType: "String",
}