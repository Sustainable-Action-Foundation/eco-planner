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
  id: string,
  metrics: (ScbMetric)[],
  variables: (ScbVariable)[],
  times: (ScbTimeVariable)[],
  language: string,
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