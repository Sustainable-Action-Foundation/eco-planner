// Use server in order to circumvent CORS issues
"use server";

import type { JSONValue } from "@/types";
import type { ApiTableContent } from "../api/apiTypes";
import { ExternalDataset } from "../api/utility";
import getPxWebTableDetails from "./getPxWebTableDetails";
import type { PxWebApiV2TableContent } from "./pxWebApiV2Types";

export default async function getPxWebTableContent(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[], language?: string,) {
  // Get the base URL for the external dataset, defaulting to SCB
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset) ?? ExternalDataset.SCB;
  const url = new URL(`./tables/${tableId}/data`, dataset.baseUrl);

  if (!language || !dataset.supportedLanguages.includes(language)) {
    language = dataset.supportedLanguages[0];
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
    if (item.variableCode === "metrics" || item.variableCode === "metric") {
      const selectionItem = {
        variableCode: "ContentsCode",
        valueCodes: item.valueCodes,
      };
      payload.selection.push(selectionItem);
    }
    else if (item.variableCode !== "Tid" && item.variableCode !== "Time") {
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

  const timeSelectionItemInPayload = payload.selection.filter(item => item.variableCode === "Tid" || item.variableCode === "Time")[0];
  if (!timeSelectionItemInPayload) {
    // Get all time periods that are available for this table and add them to payload
    const timeSelectionItem = { variableCode: "Tid", valueCodes: [] as string[], };
    const times = await getPxWebTableDetails(tableId, externalDataset).then(result => result ? result.times : undefined);
    if (!times) return null;
    timeSelectionItem.valueCodes.push(`from(${times[0].id})`);
    payload.selection.push(timeSelectionItem);
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

      // Make sure content type is application/json (actually json-px, but it's basically just json)
      if (contentType?.includes("application/json")) {
        const responseJson = await response.json() as JSONValue;
        data = responseJson;
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  function pxWebTableContentToApiTableContent(pxWebTableContent: PxWebApiV2TableContent): ApiTableContent | null {
    const resultTable: ApiTableContent = {
      id: tableId,
      values: [],
      metadata: [{
        label: pxWebTableContent.metadata[0].label,
        source: pxWebTableContent.metadata[0].source,
      }]
    };

    // Columns
    // We're only interested in the time column (type "t") and data columns (type "c").
    // We don't really care about dimension columns (type "d"), but it's worth noting that they cause years to be repeated if multiple values are allowed for any dimension,
    // in which case we will discard the data altogether and request the user to update their selection.
    const timeColumnIndex = pxWebTableContent.columns.findIndex(column => column.type === "t");

    if (timeColumnIndex === -1) {
      console.error("No time column found in pxWeb table content.");
      return null;
    }

    // Ensure no year is repeated in the time column
    const timeValues = new Set<string>();
    for (const data of pxWebTableContent.data) {
      const timeValue = data.key[timeColumnIndex];
      if (timeValues.has(timeValue)) {
        console.error("Multiple occurences found of a single time period. Please update your selection to only include one option per dimension.");
        return null;
      }
      timeValues.add(timeValue);
    }

    const dataColumns = pxWebTableContent.columns.filter(column => column.type === "c");
    if (dataColumns.length === 0) {
      console.error("No data columns found in PxWeb table content.");
      return null;
    } else if (dataColumns.length > 1) {
      console.error("Multiple data columns found in PxWeb table content. Please select only one data column.");
      return null;
    }
    // Data
    // Create all data rows that will be returned by the function
    for (const data of pxWebTableContent.data) {
      resultTable.values.push({
        period: data.key[timeColumnIndex],
        value: data.values[0], // We expect exactly one value per row, so we can safely access it by index 0
      });
    };

    return resultTable;
  }

  if (data instanceof Object && "columns" in data && "data" in data && "metadata" in data) {
    return pxWebTableContentToApiTableContent(data as PxWebApiV2TableContent);
  } else {
    return null;
  }
}