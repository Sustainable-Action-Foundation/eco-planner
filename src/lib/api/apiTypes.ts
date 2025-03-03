import { string } from "mathjs"

export type ApiTableDetails = {
  id: string
  metrics: (TrafaMetric | ScbMetric)[]
  hierarchies: (TrafaHierarchy | string)[]
  variables: (TrafaVariable | ScbVariable)[]
  language: string
}

// TODO - which types actually use description?

export type ScbMetric = {
  id: string
  index: number
  label: string
  unit: { base: string, decimals: number }
}

export type ScbVariable = {
  name: string,
  label: string,
  elimination: boolean, // What is this?
  show: "value", // What is this and what are the other possible values?
  categoryNoteMandatory?: {[variableValueId: string]: { [arrayIndex: string]: boolean}}, // What is this for?
  values: ScbVariableValue[],
}

export type ScbVariableValue = {
  id: string,
  index: number,
  label: string,
  note?: string[]
}

export type TrafaMetric = { // Marked as "M"
  trafaId: number,
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}

export type TrafaHierarchy = { // Marked as "H"
  trafaId: number,
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
  trafaId: number,
  dataType: "String" | "Time" | "Region", // Is this ever "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
  values?: (TrafaVariable | TrafaVariableValue | TrafaFilter)[] // "Variable" children are not found in structure items array, they are found by marking another "Variable" as parent. This is not always the case when there are multiple variables under a hierarchy, but sometimes. Does not seem connected to how many variables are under a hierarchy.
}

export type TrafaVariableValue = { // Marked as "DV"
  trafaId: number,
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}

export type TrafaFilter = { // Very similar to variable value, UniqueIds imply that they are basically the same. In reality, one filter seems to overwrite all other filters and variable values.
  trafaId: number
  dataType: "String" | "Time" | "Region", // Is this ever "Time" or "Region"?
  label: string,
  name: string,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // What is this for?
  description: string,
}