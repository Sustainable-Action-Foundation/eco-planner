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
  metrics: (TrafaMetric | ScbMetric)[],
  hierarchies: (TrafaHierarchy)[],
  variables: (TrafaVariable | ScbVariable)[],
  times: (TrafaVariable | ScbTimeVariable)[],
  language: string,
}

export type ApiStructureTypeBase = {
  type: string,
  id: string,
  name: string,
  label: string,
}

// TODO - check if scb variables and things should be named PxWeb instead
export type ScbStructureTypeBase = ApiStructureTypeBase & {
  // Add additional properties for scb (maybe it should be called pxweb) here if necessary
}

export type ScbMetric = ScbStructureTypeBase & {
  index: number,
  unit: { base: string, decimals: number },
}

export type ScbVariable = ScbStructureTypeBase & {
  optional: boolean,
  option: boolean,
  elimination: boolean, // This is whether the variable is required or not
  show: "value", // What is this and what are the other possible values?
  categoryNoteMandatory?: { [variableValueId: string]: { [arrayIndex: string]: boolean } }, // What is this for?
  values: ScbVariableValue[],
}

export type ScbVariableValue = ScbStructureTypeBase & {
  index: number,
  note?: string[],
}

export type ScbTimeVariable = ScbStructureTypeBase & {
  elimination: boolean, // This is whether the variable is required or not
  show: "value", // What is this and what are the other possible values?
}

// TODO - which types actually use description?
export type TrafaStructureTypeBase = ApiStructureTypeBase & {
  trafaId: number,
  parentName: string | null,
  selected: boolean, // What is this for?
  option: boolean, // This indicates whether the item should be displayed or not
  description: string,
}

export type TrafaMetric = TrafaStructureTypeBase & { // Marked as "M"
  dataType: "String" | "Time" | "Region", // TODO - Is this ever "Time" or "Region"?
}

export type TrafaHierarchy = TrafaStructureTypeBase & { // Marked as "H"
  dataType: "String" | "Time" | "Region", // TODO - Is this ever "Time"?
  children?: TrafaVariable[],
}

export type TrafaVariable = TrafaStructureTypeBase & { // Marked as "D"
  dataType: "String" | "Time" | "Region", // TODO - Is this ever "Region"?
  optional: boolean,
  values?: (TrafaVariable | TrafaVariableValue | TrafaFilter)[], // "Variable" children are not found in structure items array, they are found by marking another "Variable" as parent. This is not always the case when there are multiple variables under a hierarchy, but sometimes. Does not seem connected to how many variables are under a hierarchy.
}

export type TrafaVariableValue = TrafaStructureTypeBase & { // Marked as "DV"
  dataType: "String" | "Time" | "Region", // TODO - Is this ever "Time" or "Region"?
}

export type TrafaFilter = TrafaStructureTypeBase & { // Marked as "F"
  dataType: "String" | "Time" | "Region", // TODO - Is this ever "Time" or "Region"?
}