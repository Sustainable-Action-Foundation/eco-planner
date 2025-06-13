"use server";

import { ApiTableContent } from "../api/apiTypes.ts";
import { externalDatasets } from "../api/utility.ts";
import { TrafaDataResponse } from "./trafaTypes.ts";
import { getTrafaSearchQueryString } from "./trafaUtility.ts";

// Trafa is a Swedish transport data provider. As such, their data is only relevant for usage in Sweden.
// This means that everything here in the `trafa` folder is somewhat useless for international implementations,
// but can be useful to show how to implement a new data provider which doesn't follow the pxWebV2 standard.

export default async function getTrafaTableContent(tableId: string, selection: { variableCode: string, valueCodes: string[] }[], language?: "sv" | "en") {
  const searchQuery = getTrafaSearchQueryString(selection);

  const url = new URL('./data', externalDatasets.Trafa?.baseUrl);
  url.searchParams.append('query', tableId + searchQuery);
  language = "sv"
  if (language) url.searchParams.append('lang', language);

  let data: TrafaDataResponse | null = null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      data = await response.json();
    } else {
      console.log("bad response", response);
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  function trafaTableContentToApiTableContent(trafaTableContent: TrafaDataResponse): ApiTableContent {
    const returnTable: ApiTableContent = {
      id: tableId,
      columns: [],
      data: [],
      metadata: [],
    };

    // Columns
    // Create all columns of data info and add them to returnTable
    const columns = [];
    for (const column of trafaTableContent.Header.Column) {
      const pushColumn = {
        id: column.Name,
        label: column.Value, // TODO - label needs to be manually translated here when internationalization is implemented
        type: column.DataType === "Time" ? "t" : column.Type.toLowerCase() as "t" | "d" | "m",
      };
      columns.push(pushColumn);
    }
    const timeColumns = columns.filter(column => column.type == "t").map(column => column.label);
    returnTable.columns.push({ id: "Tid", label: timeColumns[timeColumns.length - 1], type: "t" });

    columns.map(column => {
      if (column.type != "t") {
        returnTable.columns.push(column);
      }
    })

    // Data
    // Create all data rows that will be returned by the function
    for (const data of trafaTableContent.Rows) {
      const pushData = {
        key: [] as { columnId: string, value: string }[],
        values: [] as string[],
      };
      const timeColumnIds = columns.filter(column => column.type == "t").map(column => column.id);
      const timeColumns = [];
      for (let i = 0; i < data.Cell.length; i++) {
        if (timeColumnIds.includes(data.Cell[i].Column)/* !data.Cell[i].IsMeasure */) {
          timeColumns.push({ columnId: data.Cell[i].Column, value: data.Cell[i].Name });
        }
        else if (data.Cell[i].IsMeasure) {
          pushData.values.push(data.Cell[i].Value);
        }
      }
      if (timeColumns.length > 1) {
        if (timeColumns[1].value != "t1") {
          if (timeColumns[1].columnId == "kvartal") {
            pushData.key.push({ columnId: "Tid", value: `${timeColumns[0].value}K${timeColumns[1].value}` });
          } else if (timeColumns[1].columnId == "manad") {
            pushData.key.push({ columnId: "Tid", value: `${timeColumns[0].value}M${timeColumns[1].value}` });
          }
          returnTable.data.push(pushData);
        }
      } else if (timeColumns.length == 1) {
        pushData.key = [{ columnId: "Tid", value: timeColumns[0].value }];
        returnTable.data.push(pushData);
      }
    }

    // Metadata
    // Create metadata and add to returnTable
    const metadataEntry = { label: "", source: "Trafa" };
    const metric = returnTable.columns.filter(column => column.type == "m").map(column => column.label)[0];

    // Define different variable strings depending on how many variables are used
    const variables = returnTable.columns.filter(column => column.type == "d").map(column => column.label.toLowerCase());
    const variablesString = variables.length == 0 ? undefined : variables.length == 1 ? variables[0] : `${variables.slice(0, -1).join(", ")} och ${variables.pop()}`;

    // Create different metadata label depending on variable string and table name
    metadataEntry.label = `${(trafaTableContent.Name ?? "")} - ${metric}${variablesString ? ` efter ${variablesString}` : ""}`; // TODO - translate this manually when internationalization is implemented
    returnTable.metadata.push(metadataEntry);

    return returnTable;
  }

  if (data) return trafaTableContentToApiTableContent(data);

  return data;
}