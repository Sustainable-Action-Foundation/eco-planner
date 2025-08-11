"use server";

import { ApiTableContent } from "../api/apiTypes.ts";
import { ExternalDataset } from "../api/utility.ts";
import { TrafaDataResponse } from "./trafaTypes.ts";
import { getTrafaSearchQueryString } from "./trafaUtility.ts";

// Trafa is a Swedish transport data provider. As such, their data is only relevant for usage in Sweden.
// This means that everything here in the `trafa` folder is somewhat useless for international implementations,
// but can be useful to show how to implement a new data provider which doesn't follow the pxWebV2 standard.

export default async function getTrafaTableContent(tableId: string, selection: { variableCode: string, valueCodes: string[] }[], language?: string) {
  const searchQuery = getTrafaSearchQueryString(selection);

  const url = new URL('./data', ExternalDataset.Trafa.baseUrl);
  url.searchParams.append('query', tableId + searchQuery);
  if (!language || !ExternalDataset.Trafa.supportedLanguages.includes(language)) {
    language = ExternalDataset.Trafa.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }

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

  function trafaTableContentToApiTableContent(trafaTableContent: TrafaDataResponse): ApiTableContent | null {
    const result: ApiTableContent | null = {
      id: tableId,
      values: [],
      metadata: [{
        label: trafaTableContent.Name ?? "",
        source: "Trafa",
      }]
    }

    const timeColumns = trafaTableContent.Header.Column.filter(column => column.DataType === "Time");
    const dataColumns = trafaTableContent.Header.Column.filter(column => column.Type === "M");

    if (dataColumns.length === 0) {
      console.warn("No data columns found in Trafa table content");
      return null;
    } else if (dataColumns.length > 1) {
      console.warn("Multiple data columns found in Trafa table content");
      return null;
    }

    if (timeColumns.length == 0) {
      console.warn("No time columns found in Trafa table content");
      return null;
    } else if (timeColumns.length > 1) {
      const yearColumnId = trafaTableContent.Header.Column.findIndex(column => column.Name === "ar");
      if (yearColumnId === -1) {
        console.warn("No year column found in Trafa table content with multiple time columns");
        return null;
      }
      const monthColumnId = trafaTableContent.Header.Column.findIndex(column => column.Name === "manad");
      const quarterColumnId = trafaTableContent.Header.Column.findIndex(column => column.Name === "kvartal");

      if (monthColumnId >= 0 && quarterColumnId >= 0) {
        console.warn("Both month and quarter columns found in Trafa table content with multiple time columns");
        return null;
      } else if (monthColumnId >= 0) {
        for (const data of trafaTableContent.Rows) {
          const yearValue = data.Cell.find(cell => cell.Column === "ar")?.Value;
          const monthValue = data.Cell.find(cell => cell.Column === "manad")?.Value;
          const dataValue = data.Cell.find(cell => cell.IsMeasure)?.Value;
          if (yearValue != undefined && monthValue != undefined && dataValue != undefined) {
            result.values.push({
              period: `${yearValue}M${monthValue}`,
              value: dataValue
            })
          } else {
            console.warn("Missing year or month value in Trafa table content with multiple time columns");
            return null;
          }
        }
      } else if (quarterColumnId >= 0) {
        for (const data of trafaTableContent.Rows) {
          const yearValue = data.Cell.find(cell => cell.Column === "ar")?.Value;
          const quarterValue = data.Cell.find(cell => cell.Column === "kvartal")?.Value;
          const dataValue = data.Cell.find(cell => cell.IsMeasure)?.Value;
          if (yearValue != undefined && quarterValue != undefined && dataValue != undefined) {
            result.values.push({
              period: `${yearValue}K${quarterValue}`,
              value: dataValue
            });
          } else {
            console.warn("Missing year or quarter value in Trafa table content with multiple time columns");
            return null;
          }
        }
      } else {
        console.warn("No month or quarter column found in Trafa table content with multiple time columns. Found columns follow: ", timeColumns.map(column => column.Name));
        return null;
      }
    } else if (timeColumns.length == 1) {
      for (const data of trafaTableContent.Rows) {
        const timeValue = data.Cell.find(cell => cell.Column === timeColumns[0].Name)?.Value;
        const dataValue = data.Cell.find(cell => cell.IsMeasure)?.Value;
        if (timeValue != undefined && dataValue != undefined) {
          result.values.push({
            period: timeValue,
            value: dataValue
          });
        } else {
          console.warn("Missing time or data value in Trafa table content with single time column");
          return null;
        }
      }
    }

    return result;
  }

  if (data) return trafaTableContentToApiTableContent(data);

  return data;
}