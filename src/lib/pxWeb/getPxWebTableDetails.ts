import { ApiTableDetails, PxWebMetric, PxWebTimeVariable, PxWebVariable, PxWebVariableValue } from "../api/apiTypes";
import { externalDatasets } from "../api/utility";

export async function getPxWebTableDetails(tableId: string, externalDataset: string, language: string = 'sv') {
  // Get the base URL for the external dataset, defaulting to SCB
  const baseUrl = externalDatasets[externalDataset as keyof typeof externalDatasets].baseUrl ?? externalDatasets.SCB.baseUrl;
  const url = new URL(`${baseUrl}/tables/${tableId}/metadata`);

  console.time("pxWebTableDetails");

  url.searchParams.append('lang', language);

  // Data is used to store the response when fetching
  let data;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      data = await response.json();
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
    hierarchies: [],
    variables: [],
    times: [],
    language: language,
  };

  // Get all metrics for the table and add to tableDetails
  const metricsCategory = data.dimension.ContentsCode.category;
  for (const key in metricsCategory.index) {
    const pxWebMetric: PxWebMetric = {
      type: "metric",
      id: key,
      name: key,
      index: metricsCategory.index[key],
      label: metricsCategory.label[key],
      unit: metricsCategory.unit[key],
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
      categoryNoteMandatory: pxWebItem.extension.categoryNoteMandatory ?? null,
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
      };
      try {
        if (pxWebItem.category.note[key]) {
          pxWebVariableValue.note = pxWebItem.category.note[key];
        }
      } catch { }
      pxWebVariable.values.push(pxWebVariableValue);
    }

    tableDetails.variables.push(pxWebVariable);
  }

  console.timeEnd("pxWebTableDetails");
  return tableDetails;
}