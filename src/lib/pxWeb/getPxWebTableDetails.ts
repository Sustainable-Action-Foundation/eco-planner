import type { ApiTableDetails } from "../api/apiTypes";
import { ExternalDataset } from "../api/utility";
import type { PxWebApiV2MetricDimension, PxWebApiV2StandardDimension, PxWebApiV2TableDetails, PxWebMetric, PxWebTimeVariable, PxWebVariable, PxWebVariableValue } from "./pxWebApiV2Types";

export default async function getPxWebTableDetails(tableId: string, externalDataset: string, language?: string): Promise<ApiTableDetails | null> {
  if (!tableId || !externalDataset) {
    console.debug("getPxWebTableDetails called without required parameters, returning early", { tableId, externalDataset, language });
    return null;
  }

  // Get the base URL for the external dataset, defaulting to SCB
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset) ?? ExternalDataset.SCB;
  const url = new URL(`./tables/${tableId}/metadata`, dataset.baseUrl);

  if (!language || !dataset.supportedLanguages.includes(language)) {
    language = dataset?.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }

  // Data is used to store the response when fetching
  // I can't be bothered to typeguard this right now, just assume it has the right type
  let data: PxWebApiV2TableDetails;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      data = await response.json() as PxWebApiV2TableDetails;
    } else if (response.status === 429) {
      // Wait 10 seconds and try again
      console.debug(`Received 429 status, retrying in 10 seconds...`, { url, response });
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await getPxWebTableDetails(tableId, externalDataset, language);
    } else if (response.status === 404) {
      console.error(`${response.status}; No metadata found for table ${tableId} in dataset ${externalDataset}`, { url, response });
      return null;
    } else {
      console.error(`Unusual status ${response.status}; No metadata found for table ${tableId} in dataset ${externalDataset}`, { url, response });
      return null;
    }
  }
  catch (error) {
    console.error("Error fetching table details from PxWeb API", { error }, `Query URL: ${url}`);
    return null;
  }

  // Declare the variable that will be returned by the function
  const tableDetails: ApiTableDetails = {
    id: tableId,
    metrics: [],
    variables: [],
    times: [],
    language: language,
  };

  const metricName = data.role.metric[0]; // The variable name for the metric is usually "ContentsCode", but we will get it from the response just to be sure (Energimyndigheten seems to use "CONTENTS" instead)
  console.debug("metricName: ", metricName);
  if (!metricName) {
    console.error("No metric variable found in table details response", { data });
    return null;
  } else if (!data.dimension[metricName]) {
    console.error(`Metric variable "${metricName}" not found in table details response`, { data });
    return null;
  }

  const timeVariableName = data.role.time[0]; // The variable name for time is usually "Tid" or "Time", but we will get it from the response just to be sure
  if (!timeVariableName) {
    console.error("No time variable found in table details response", { data });
    return null;
  } else if (!data.dimension[timeVariableName]) {
    console.error(`Time variable "${timeVariableName}" not found in table details response`, { data });
    return null;
  }

  // Get all metrics for the table and add to tableDetails
  const metricsCategory = (data.dimension[metricName] as PxWebApiV2MetricDimension).category;
  for (const key in metricsCategory.index) {
    const pxWebMetric: PxWebMetric = {
      type: "metric",
      id: key,
      name: metricsCategory.label[key],
      index: metricsCategory.index[key],
      label: metricsCategory.label[key],
      unit: metricsCategory.unit?.[key],
    };
    tableDetails.metrics.push(pxWebMetric);
  }

  // Find all time periods for the table and add to tableDetails
  const timeCategory = (data.dimension[timeVariableName] as PxWebApiV2StandardDimension).category;
  for (const key in timeCategory.index) {
    const pxWebItem: PxWebApiV2StandardDimension = data.dimension[timeVariableName];
    const pxWebTimeVariable: PxWebTimeVariable = {
      type: "time",
      id: key,
      name: pxWebItem.category.label[key],
      label: pxWebItem.label,
      optional: true,
      elimination: pxWebItem.extension.elimination,
      show: pxWebItem.extension.show,
    };

    tableDetails.times.push(pxWebTimeVariable);
  }

  // Find all variables for the table and add to tableDetails
  for (const variableName of data.extension.px.stub) {
    const pxWebItem = data.dimension[variableName];
    const pxWebVariable: PxWebVariable = {
      type: "variable",
      id: variableName,
      name: variableName,
      label: pxWebItem.label,
      optional: pxWebItem.extension.elimination,
      option: true,
      elimination: pxWebItem.extension.elimination,
      show: pxWebItem.extension.show,
      categoryNoteMandatory: pxWebItem.extension.categoryNoteMandatory,
      values: [],
    };

    // Find all values for the variable and add them to the variable object
    for (const key in pxWebItem.category.index) {
      const pxWebVariableValue: PxWebVariableValue = {
        type: "variableValue",
        id: key,
        name: key,
        index: pxWebItem.category.index[key],
        label: pxWebItem.category.label[key],
        note: pxWebItem.category.note?.[key],
      };
      pxWebVariable.values.push(pxWebVariableValue);
    }

    tableDetails.variables.push(pxWebVariable);
  }

  console.log("Fetched table details from PxWeb API", { tableDetails });
  return tableDetails;
}