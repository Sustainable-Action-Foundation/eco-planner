import type { ApiTableDetails } from "../api/apiTypes";
import { ExternalDataset } from "../api/utility";
import type { PxWebApiV2MetricDimension, PxWebApiV2TableDetails, PxWebMetric, PxWebTimeVariable, PxWebVariable, PxWebVariableValue } from "./pxWebApiV2Types";

export default async function getPxWebTableDetails(tableId: string, externalDataset: string, language?: string) {
  // Get the base URL for the external dataset, defaulting to SCB
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset) || ExternalDataset.SCB;
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
    } else if (response.status == 429) {
      // Wait 10 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await getPxWebTableDetails(tableId, externalDataset, language);
    } else {
      return null;
    }
  } catch (error) {
    console.log(error);
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

  // Get all metrics for the table and add to tableDetails
  const metricsCategory = (data.dimension.ContentsCode as PxWebApiV2MetricDimension).category;
  for (const key in metricsCategory.index) {
    const pxWebMetric: PxWebMetric = {
      type: "metric",
      id: key,
      name: key,
      index: metricsCategory.index[key],
      label: metricsCategory.label[key],
      unit: metricsCategory.unit?.[key],
    };
    tableDetails.metrics.push(pxWebMetric);
  }

  // Find all time periods for the table and add to tableDetails
  const timeCategory = data.dimension.Tid.category
  for (const timeVariableName in timeCategory.index) {
    const pxWebItem = data.dimension.Tid;
    const pxWebTimeVariable: PxWebTimeVariable = {
      type: "time",
      id: timeVariableName,
      name: timeVariableName,
      label: pxWebItem.label,
      optional: true,
      elimination: pxWebItem.extension.elimination,
      show: pxWebItem.extension.show,
    };

    tableDetails.times.push(pxWebTimeVariable);
  }

  // Find all variables for the table and add to tableDetails
  for (const variableName of data.extension.px.stub) {
    const pxWebItem = data.dimension[variableName]
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

  /* console.timeEnd("pxWebTableDetails"); */
  return tableDetails;
}