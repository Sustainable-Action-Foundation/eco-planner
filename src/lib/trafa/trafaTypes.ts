import { ApiDetailItemBase } from "../api/apiTypes"

export type TrafaDataResponse = {
  Header: {
    Column: {
      Name: string,
      Type: "D" | "M",
      DataType: "String" | "Time" | "Region",
      Filters: string[] | null,
      Value: string,
      Unit: string | null,
      Description: string,
      UniqueId: string,
    }[],
    Description: string | null,
  },
  Rows: {
    Cell: {
      Name: string,
      IsMeasure: boolean,
      Description: string,
      Column: string,
      /** When `isMeasure == true` this is usually either a stringified number or "-" */
      Value: string,
      FormattedValue: string,
      Level: string,
      Gis: string,
      UniqueId: string,
      /** The Ids here refer to the keys in `Notes`, however, they are numbers here and strings there */
      NoteIds: number[],
      Versions: {
        Key: string, // Usually/always ISO 8601 date strings?
        Value: string,
      }[],
    }[],
    IsTotal: boolean,
  }[],
  Errors: string[] | null,
  Description: string | null,
  Name: string | null,
  OriginalName: string | null,
  /** The keys are stringified numbers corresponding to the numbers found in `Rows.Cell[].NoteIds[]` */
  Notes: {
    [key: string]: string,
  } | null,
  NextPublishDate: string, // ISO 8601 date string
  ActiveFrom: string, // ISO 8601 date string
  ValidatedRequestType: string | null,
  StructureItems: StructureItem[],
}

export type StructureItem = {
  Id: number,
  DataType: "String" | "Time" | "Region",
  Label: string,
  FullLabel: null, // Is it always null?
  Name: string,
  ParentName: string | null,
  FullName: null, // Is it always null?
  /**
   * P: Tables; has an empty array for `StructureItems`.
   * M: Measure; has an empty array for `StructureItems`.
   * H: Contains multiple dimensions (`Type: "D"`) in `StructureItems`.
   * D: Dimension; has a filled array for `StructureItems`.
   * F: Probably dynamic item in a dimension, so far only seen under parents with `DataType: "Time"`. Has an empty array for `StructureItems`.
   * DV: A specific value in a dimension, used as a filter. Has an empty array for `StructureItems`.
   */
  Type: "P" | "D" | "M" | "F" | "H" | "DV",
  Selected: boolean,
  Option: boolean,
  Description: string,
  UniqueId: string,
  ActiveFrom: string, // ISO 8601 date string
  StructureItems: StructureItem[],
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