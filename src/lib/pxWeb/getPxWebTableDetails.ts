import { ApiTableDetails, ScbMetric, ScbTimeVariable, ScbVariable, ScbVariableValue } from "../api/apiTypes";
import { externalDatasetBaseUrls } from "../api/utility";

export async function getPxWebTableDetails(tableId: string, externalDataset: string, language: string = 'sv') {
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  const url = new URL(`${baseUrl}/tables/${tableId}/metadata`);

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
    const scbMetric: ScbMetric = {
      type: "metric",
      id: key,
      name: key,
      index: metricsCategory.index[key],
      label: metricsCategory.label[key],
      unit: metricsCategory.unit[key],
    };
    tableDetails.metrics.push(scbMetric);
  }

  // Find all time periods for the table and add to tableDetails
  const timeCategory = data.dimension.Tid.category
  for (const timeVariableName in timeCategory.index) {
    const scbItem = data.dimension.Tid;
    const scbTimeVariable: ScbTimeVariable = {
      type: "time",
      id: timeVariableName,
      name: timeVariableName,
      label: scbItem.label,
      elimination: scbItem.extension.elimination,
      show: scbItem.extension.show,
    };

    tableDetails.times.push(scbTimeVariable);
  }

  // Find all variables for the table and add to tableDetails
  for (const variableName of data.extension.px.stub) {
    const scbItem = data.dimension[variableName]
    const scbVariable: ScbVariable = {
      type: "variable",
      id: variableName,
      name: variableName,
      label: scbItem.label,
      optional: scbItem.extension.elimination,
      option: true,
      elimination: scbItem.extension.elimination,
      show: scbItem.extension.show,
      categoryNoteMandatory: scbItem.extension.categoryNoteMandatory ?? null,
      values: [],
    };

    // Find all values for the variable and add them to the variable object
    for (const key in scbItem.category.index) {
      const scbVariableValue: ScbVariableValue = {
        type: "variableValue",
        id: key,
        name: key,
        index: scbItem.category.index[key],
        label: scbItem.category.label[key],
      };
      try {
        if (scbItem.category.note[key]) {
          scbVariableValue.note = scbItem.category.note[key];
        }
      } catch { }
      scbVariable.values.push(scbVariableValue);
    }

    tableDetails.variables.push(scbVariable);
  }

  return tableDetails;
}