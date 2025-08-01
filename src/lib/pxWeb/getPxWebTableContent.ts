// Use server in order to circumvent CORS issues
"use server";

import { JSONValue } from "@/types.ts";
import { ApiTableContent } from "../api/apiTypes.ts";
import { externalDatasets } from "../api/utility.ts";
import getPxWebTableDetails from "./getPxWebTableDetails.ts";
import { PxWebApiV2TableContent } from "./pxWebApiV2Types.ts";

export default async function getPxWebTableContent(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[], language?: string,) {
  // Get the base URL for the external dataset, defaulting to SCB
  const baseUrl = externalDatasets[externalDataset]?.baseUrl ?? externalDatasets.SCB?.baseUrl;
  const url = new URL(`./tables/${tableId}/data`, baseUrl);

  if (!language || !externalDatasets[externalDataset]?.supportedLanguages.includes(language)) {
    language = externalDatasets[externalDataset]?.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }
  url.searchParams.append('outputformat', 'json-px'); // Decide preferred format of the response. Available formats are "csv", "px", "json-px", "json-stat2", "html", "parquet" and "xlsx"

  const payload = {
    selection: [] as { variableCode: string, valueCodes: string[] }[],
    response: {
      format: "json-px",
    },
  };



  // Add all selection items to payload
  selection.forEach(item => {
    if (item.variableCode == "metrics" || item.variableCode == "metric") {
      const selectionItem = {
        variableCode: "ContentsCode",
        valueCodes: item.valueCodes,
      };
      payload.selection.push(selectionItem);
    }
    else if (item.variableCode != "Tid" && item.variableCode != "Time") {
      const selectionItem = {
        variableCode: item.variableCode,
        valueCodes: item.valueCodes,
      };
      payload.selection.push(selectionItem);
    }
    else {
      const timeSelectionItem = {
        variableCode: item.variableCode,
        valueCodes: item.valueCodes,
      }
      payload.selection.push(timeSelectionItem);
    }
  });

  const timeSelectionItemInPayload = payload.selection.filter(item => item.variableCode == "Tid" || item.variableCode == "Time")[0];
  if (!timeSelectionItemInPayload) {
    // Get all time periods that are available for this table and add them to payload
    const timeSelectionItem = { variableCode: "Tid", valueCodes: [] as string[], };
    const times = await getPxWebTableDetails(tableId, externalDataset).then(result => result ? result.times : undefined);
    if (!times) return null;
    timeSelectionItem.valueCodes.push(`from(${times[0].id})`);
    payload.selection.push(timeSelectionItem);
  }

  // TODO - make this parse in the same format as if it were json
  function parsePxToJson(pxText: string) {
    const json: Record<string, string | string[] | number | number[]> = {};

    const cleanedPxText = pxText.replace("\r", "");
    // Split the response line by line
    let lines = cleanedPxText.split(";");
    for (const line of lines) {
      lines[lines.indexOf(line)] = line.split(" \r").join("").split("\r").join("").split("\n").join("");
    }
    lines = lines.filter((entry) => { return entry.trim() != ''; });

    for (const line of lines) {
      const match = line.match(/^(.+?)=(.+)$/); // Find KEY=VALUE;
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove citation marks if they exist
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        json[key] = value;
      }
    }
    // Convert response values to a list
    json.DATA = (json.DATA as string).split(" ");

    if (json.UNITS == "number" || json.UNITS == "antal") {
      json.DATA = (json.DATA).map(Number);
    }

    return json;
  }

  // TODO - make this parse in the same format as if it were json
  function parseCsv(csv: string) {
    const rows = csv.split("\n").map(row => row.split(","));
    const headers = rows.shift()?.map(h => h.replace(/"/g, "").trim()); // First row as headers

    if (!headers) throw new Error("CSV saknar headers!");

    return rows
      .filter(row => row.some(value => value.trim() !== ""))
      .map(row => {
        const obj: Record<string, string | number | null> = {};
        row.forEach((value, index) => {
          let cleanedValue: string | number | null = value.replace(/"/g, "").replace(/\r/g, "").trim(); // Remove citation marks and \r
          if (cleanedValue === "..") {
            cleanedValue = null;
          } else if (!isNaN(Number(cleanedValue)) && headers[index] != "Sektor") {
            cleanedValue = Number(cleanedValue); // Convert numerical values
          }
          obj[headers[index]] = cleanedValue; // Set values with headers as keys
        });
        return obj;
      });
  }

  let data: JSONValue = null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(errorText);
    }

    if (response.ok) {
      const contentType = response.headers.get("Content-Type");

      // Parse response differently depending on its content type
      if (contentType?.includes("application/octet-stream")) {
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder("iso-8859-1");
        const decodedText = decoder.decode(buffer);
        const parsedPx = parsePxToJson(decodedText);
        data = parsedPx;
      }
      else if (contentType?.includes("text/csv")) {
        const csvText = await response.text();
        const parsedCsv = parseCsv(csvText);
        data = parsedCsv;
      }
      else if (contentType?.includes("application/json")) {
        const responseJson = await response.json();
        data = responseJson;
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  function pxWebTableContentToApiTableContent(pxWebTableContent: PxWebApiV2TableContent): ApiTableContent {
    const returnTable: ApiTableContent = {
      id: tableId,
      columns: [],
      data: [],
      metadata: [{
        label: pxWebTableContent.metadata[0].label,
        source: pxWebTableContent.metadata[0].source,
      }],
    };

    // Columns
    // Create all columns of data info and add them to returnTable
    for (const column of pxWebTableContent.columns) {
      const pushColumn = {
        id: column.code,
        label: column.text,
        type: column.type === "c" ? "m" : column.type as "t" | "d" | "m",
      };
      returnTable.columns.push(pushColumn);
    }

    // Data
    // Create all data rows that will be returned by the function
    for (const data of pxWebTableContent.data) {
      const pushData = {
        key: [] as { columnId: string, value: string }[],
        values: data.values,
      };
      for (let i = 0; i < data.key.length; i++) {
        pushData.key.push({ columnId: returnTable.columns[i].id, value: data.key[i] });
      };
      returnTable.data.push(pushData);
    };

    return returnTable;
  }

  if (data instanceof Object && "columns" in data && "data" in data && "metadata" in data) {
    return pxWebTableContentToApiTableContent(data as PxWebApiV2TableContent);
  } else {
    return null;
  }
}