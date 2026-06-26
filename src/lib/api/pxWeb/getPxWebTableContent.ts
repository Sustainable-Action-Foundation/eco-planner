// Use server in order to circumvent CORS issues
"use server";

import { isStandardObject, type JSONValue } from "@/types";
import type { ApiTableContent, ApiSelectionItem } from "../apiTypes";
import { ExternalDataset } from "../utility";
import getPxWebTableMetadata from "./getPxWebTableMetadata";
import type { PxWebTableContent } from "./pxWebApiV2Types";

export default async function getPxWebTableContent(tableId: string, externalDataset: string, selection: ApiSelectionItem[], language?: string) {
  // Get the base URL for the external dataset, defaulting to SCB
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset) ?? ExternalDataset.SCB;
  const url = new URL(`./tables/${tableId}/data`, dataset.baseUrl);

  if (!language || !dataset.supportedLanguages.includes(language)) {
    language = dataset.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }
  // Decide preferred format of the response. Available formats are "json-stat2" (application/json), "json-px" (application/json), "csv" (text/csv), "px" (application/octet-stream), "xlsx" (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet), and "html" (text/html)
  url.searchParams.append('outputFormat', 'json-stat2');

  const payload: { selection: ApiSelectionItem[] } = {
    selection: selection,
  };

  // If no time selection is provided, try to add a default time selection to the payload
  const times = await getPxWebTableMetadata(tableId, externalDataset).then(result => result ? result.timeDimensions : undefined);
  if (times && times.length !== 1 && !times.every(time => payload.selection.some(item => item.variableCode === time.id))) {
    console.debug(`Too many time dimensions (${times.length}) to automatically select one to include all periods for; please ensure all time dimensions have defined selections. tableId: ${tableId}; dataset: ${externalDataset}`);
    return null;
  } else if (times?.length === 1 && !payload.selection.some(item => item.variableCode === times[0].id)) {
    // If there is only one time dimension, and it is not already included in the selection, add it to the selection with all available periods
    const timeSelectionItem = {
      variableCode: times[0].id,
      valueCodes: [`from(${times[0].options[0].value})`],
    };
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

      // Make sure content type is application/json (actually json-stat2, but it's basically just fancy json)
      if (contentType?.includes("application/json")) {
        const responseJson = await response.json() as JSONValue;
        data = responseJson;
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }
    }
  }
  catch (error) {
    console.error("Error fetching table content from PxWeb API", { error });
    return null;
  }

  function pxWebTableContentToApiTableContent(tableContent: PxWebTableContent): ApiTableContent | null {
    const resultTable: ApiTableContent = {
      id: tableId,
      values: [],
      metadata: [{
        label: tableContent.label,
        source: tableContent.source,
      }],
    };

    // Try to extract unit
    if (tableContent.role.metric?.length === 1) {
      const metricDimensionName = tableContent.role.metric[0];
      const metricDimension = tableContent.dimension[metricDimensionName];
      if ("unit" in metricDimension.category) {
        resultTable.unit = metricDimension.category.unit[Object.keys(metricDimension.category.unit)[0]];
      }
    }

    // Ensure the value array is neither empty, nor a flattened multidimensional array (which would indicate that multiple dimensions have more than one value, which we don't support)
    if (!tableContent.value || tableContent.value.length === 0) {
      console.error("No values found in PxWeb table content.");
      return null;
    } else if (tableContent.size.filter(size => size > 1).length > 1) {
      console.error("Multiple dimensions with more than one value found in PxWeb table content. Please update your selection to only include one option per dimension except the main time dimension.");
      return null;
    }

    // Find the index of the relevant dimension (probably a time dimension, but not necessarily) with more than one value
    const mainDimensionIndex = tableContent.size.findIndex(size => size > 1);
    if (mainDimensionIndex === -1) {
      if (times?.length === 1) {
        console.debug(`No dimension with more than one value found in PxWeb table content. This is supported, but may result in the wrong dimension being used as "main" dimension for reading years.`);
        const keys = Object.keys(tableContent.dimension[times[0].id].category.index ?? tableContent.dimension[times[0].id].category.label ?? {});
        if (keys.length === 0) {
          console.error("No values found in main dimension of PxWeb table content.");
          return null;
        }
        resultTable.values.push({
          // Index is guaranteed to exist if label does not
          period: tableContent.dimension[times[0].id].category.label?.[keys[0]] ?? keys[0],
          // Value should have a length of 1 if no dimension has more than one value, so we can safely access it by index 0
          value: String(tableContent.value[0] ?? ""),
        });
      } else {
        console.error("No dimension with more than one value found in PxWeb table content, and we were unable to automatically determine which dimension to use as the main dimension.");
        return null;
      }
    } else {
      // Get the name of the main dimension (probably a time dimension, but not necessarily)
      const mainDimensionName = tableContent.id[mainDimensionIndex];
      if (!mainDimensionName || !tableContent.dimension[mainDimensionName]) {
        console.error("Main dimension not found in PxWeb table content.", { mainDimensionName, tableContent });
        return null;
      }
      tableContent.value.forEach((value, index) => {
        const keys = Object.keys(tableContent.dimension[mainDimensionName].category.index ?? tableContent.dimension[mainDimensionName].category.label ?? {});
        if (index >= keys.length) {
          console.error("Index out of bounds for main dimension values in PxWeb table content.", { index, keys });
          return null;
        }
        resultTable.values.push({
          // Index is guaranteed to exist if label does not
          period: tableContent.dimension[mainDimensionName].category.label?.[keys[index]] ?? keys[index],
          value: String(value ?? ""),
        });
      });
    }

    return resultTable;
  }

  // Basic-ass type guard
  if (isStandardObject(data) && "value" in data && Array.isArray(data.value) && "dimension" in data && isStandardObject(data.dimension)) {
    return pxWebTableContentToApiTableContent(data as PxWebTableContent);
  } else {
    return null;
  }
}