'use server';

import { ApiTableContent } from "../api/apiTypes.ts";
import { TrafaDataResponse, trafaUrl } from "./trafaTypes.ts";

// Trafa is a Swedish transport data provider. As such, their data is only relevant for usage in Sweden.
// This means that everything here in the `trafa` folder is somewhat useless for international implementations,
// but can be useful to show how to implement a new data provider which doesn't follow the pxWebV2 standard.

export default async function getTrafaTableContent(tableId: string, selection: { variableCode: string, valueCodes: string[] }[], language?: 'sv' | 'en') {
  // console.log(selection);
  const variableQueries: string[] = [];
  let metric: string = "";
  for (const object of selection) {
    console.log(object);
    // console.log(object.variableCode);
    // if (object.variableCode)
    if (object.variableCode == "metric") {
      metric = object.valueCodes.join("|");
    } else {
      variableQueries.push([object.variableCode, object.valueCodes.join(",")].join(":"))
      // variableQueries
    }
  }
  let searchQuery = ""
  if (metric.length > 0) {
    searchQuery += "|" + metric
  }
  if (variableQueries.length > 0) {
    searchQuery += "|" + variableQueries.join("|")
  }
  // +[metric, variableQueries.join("|")].join("|")

  // console.log(metric, variableQueries, variableQuery)
  // console.log(searchQuery)
  const url = new URL(trafaUrl);
  url.searchParams.append('query', tableId + "|ar" + searchQuery);
  if (language) {
    url.searchParams.append('lang', language);
  }

  console.log(url)

  let data: TrafaDataResponse | null = null;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      }
    });
    if (response.ok) {
      data = await response.json();
    } else {
      console.log("bad response", response)
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
    };

    for (const column of trafaTableContent.Header.Column) {
      const pushColumn = {
        id: column.Name,
        label: column.Value,
        type: column.DataType === "Time" ? "t" : column.Type.toLowerCase() as "t" | "d" | "m",
      };
      returnTable.columns.push(pushColumn);
    }

    for (const data of trafaTableContent.Rows) {
      const pushData = {
        key: [] as { columnId: string, value: string }[],
        values: [] as string[],
      }
      // let keys: {Name: string, }[]
      // if (data.Cell)
      for (let i = 0; i < data.Cell.length; i++) {
        if (!data.Cell[i].IsMeasure) {
          pushData.key.push({ columnId: data.Cell[i].Column, value: data.Cell[i].Name });
        }
        else {
          pushData.values.push(data.Cell[i].Value)
        }
      }
      // for (let i = 0; i < data.key.length; i++) {
      //   pushData.key.push({ columnId: returnTable.columns[i].id, value: data.key[i] });
      // }
      returnTable.data.push(pushData);
    }

    return returnTable;
  }

  if (data) return trafaTableContentToApiTableContent(data);

  return data;
}