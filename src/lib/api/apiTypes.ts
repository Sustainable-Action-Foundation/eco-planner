export type ApiTableContent = {
  id: string,
  columns: {
    id: string,
    label: string,
    type: "d" | "m" | "t",
  }[],
  data: {
    key: {columnId: string, value: string}[],
    values: (string)[],
  }[],
  metadata: {
    label: string,
    source: string,
  }[],
}

export type ApiTableDetails = {
  id: string
  metrics: (TrafaMetric | ScbMetric)[]
  hierarchies: (TrafaHierarchy)[]
  variables: (TrafaVariable | ScbVariable)[]
  times: (TrafaVariable | ScbTimeVariable)[]
  language: string
}

// TODO - which types actually use description?
// TODO - add type properties?
// TODO - make sure all types have label, id and name?

export type ScbMetric = {
  type: string,
  id: string,
  name: string,
  index: number,
  label: string,
  unit: { base: string, decimals: number },
}

export type ScbVariable = {
  type: string,
  id: string,
  name: string,
  label: string,
  optional: boolean,
  option: boolean,
  elimination: boolean, // What is this? (this is whether its optional or not, but reversed)
  show: "value", // What is this and what are the other possible values?
  categoryNoteMandatory?: {[variableValueId: string]: { [arrayIndex: string]: boolean}}, // What is this for?
  values: ScbVariableValue[],
}

export type ScbVariableValue = {
  type: string,
  id: string,
  name: string,
  index: number,
  label: string,
  note?: string[],
}

export type ScbTimeVariable = {
  type: string,
  id: string,
  name: string,
  label: string,
  elimination: boolean, // What is this? (this is whether its optional or not, but reversed)
  show: "value", // What is this and what are the other possible values?
  // values: ScbVariableValue[],
}

export type TrafaMetric = { // Marked as "M"
  type: string,
  trafaId: number,
  id: string,
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}

export type TrafaHierarchy = { // Marked as "H"
  type: string,
  trafaId: number,
  id: string,
  dataType: "String" | "Time" | "Region", // Is this ever "Time"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
  children?: TrafaVariable[],
}

export type TrafaVariable = { // Marked as "D"
  type: string,
  trafaId: number,
  id: string,
  dataType: "String" | "Time" | "Region", // Is this ever "Region"?
  label: string,
  name: string,
  parentName: string | null,
  optional: boolean,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
  values?: (TrafaVariable | TrafaVariableValue | TrafaFilter)[] // "Variable" children are not found in structure items array, they are found by marking another "Variable" as parent. This is not always the case when there are multiple variables under a hierarchy, but sometimes. Does not seem connected to how many variables are under a hierarchy.
}

export type TrafaVariableValue = { // Marked as "DV"
  type: string,
  trafaId: number,
  id: string,
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}

export type TrafaFilter = { // Very similar to variable value, UniqueIds imply that they are basically the same. In reality, one filter seems to overwrite all other filters and variable values.
  type: string,
  trafaId: number
  id: string,
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}