import type { ApiHierarchyBase, ApiMetadataDimensionBase, ApiSelectOptionBase } from "../apiTypes";

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
      /** When `IsMeasure == true` this is usually either a stringified number or "-" */
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
   * M: Measure; has an empty array for `StructureItems`. Similar role to PxWeb metric dimensions.
   * H: Hierarchy; Contains multiple dimensions (`Type: "D"`) in `StructureItems`.
   * D: Dimension; has a filled array for `StructureItems`.
   * F: Filter; Probably dynamic item in a dimension, so far only seen under parents with `DataType: "Time"`. Has an empty array for `StructureItems`.
   * DV: Dimension Value; A specific value in a dimension, used as a filter. Has an empty array for `StructureItems`.
   */
  Type: "P" | "D" | "M" | "F" | "H" | "DV",
  Selected: boolean,
  Option: boolean,
  Description?: string | null,
  UniqueId: string,
  ActiveFrom: string, // ISO 8601 date string
  StructureItems: StructureItem[],
}

// TODO - which types actually use description?
export type TrafaCompatMetadataDimensionBase = Omit<ApiMetadataDimensionBase, "options"> & {
  dataType: "String" | "Time" | "Region",
  description?: string | null,
  options: (TrafaCompatDimensionValue | TrafaCompatFilter)[]
}

export type TrafaCompatMetricDimension = Omit<TrafaCompatMetadataDimensionBase, "type" | "dataType"> & { // Marked as "M"
  type: "metric";
  dataType: "String",
}

export type TrafaCompatTimeDimension = Omit<TrafaCompatMetadataDimensionBase, "type" | "dataType"> & { // Marked as "D" with DataType "Time"
  type: "time";
  dataType: "Time",
}

export type TrafaCompatRegularDimension = Omit<TrafaCompatMetadataDimensionBase, "type" | "dataType"> & { // Marked as "D" with DataType other than "Time"
  type: "dimension";
  dataType: "String" | "Region",
}

export type TrafaCompatHierarchy = Omit<ApiHierarchyBase, "id" | "children"> & { // Marked as "H"
  id: number,
  type: "hierarchy";
  dataType: "String" | "Region",
  description?: string | null,
  children: (TrafaCompatRegularDimension | TrafaCompatTimeDimension)[],
}


export type TrafaCompatSelectOptionBase = Omit<ApiSelectOptionBase, "type"> & {
  type: "dimensionValue" | "filter";
}

export type TrafaCompatDimensionValue = Omit<TrafaCompatSelectOptionBase, "type"> & { // Marked as "DV"
  type: "dimensionValue";
  dataType: "String",
}

export type TrafaCompatFilter = Omit<TrafaCompatSelectOptionBase, "type"> & { // Marked as "F"
  type: "filter";
  dataType: "String",
}