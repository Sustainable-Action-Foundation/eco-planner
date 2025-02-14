/** The URL to the Trafa API, with the path to the relevant endpoint and without any query parameters */
export const trafaUrl = 'https://api.trafa.se/api/data';
export const trafaStructureUrl = 'https://api.trafa.se/api/structure';

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
}