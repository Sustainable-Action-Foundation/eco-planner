import { externalDatasetBaseUrls } from "../api/utility";
import { ApiTableDetails, ScbMetric, ScbVariable, ScbVariableValue } from "../api/apiTypes";

export async function getPxWebTableDetails(tableId: string, externalDataset: string, language: string = 'sv') {
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  const url = new URL(`${baseUrl}/tables/${tableId}/metadata`);
  // console.log(url);
  url.searchParams.append('lang', language);

  let data;
  const tableDetails: ApiTableDetails = {
    id: tableId,
    metrics: [],
    hierarchies: [],
    variables: [],
    language: language,
  };

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
  console.log(data);
  // console.log(data.id);
  console.log(data.dimension);
  // console.log(data.extension);
  // console.log(data.role);
  // console.log(data.extension.px.heading);
  // console.log(data.extension.px.stub);
  for (const key in data.dimension) {
    console.log(key, data.dimension[key]);
  }

  const metrics: ScbMetric[] = []

  const metricsCategory = data.dimension.ContentsCode.category
  for (const key in metricsCategory.index) {
    // console.log(key)
    const scbMetric: ScbMetric = {
      type: "metric",
      id: key,
      name: key,
      index: metricsCategory.index[key],
      label: metricsCategory.label[key],
      unit: metricsCategory.unit[key]
    }
    metrics.push(scbMetric)
  }

  tableDetails.metrics = metrics;

  // console.log(metrics)
  metrics.map(item => { console.log(item) });

  // let variables: string[] = []

  // for (let item of data.extension.px.stub) {
  //   variables.push(item);
  //   console.log(item);
  //   console.log(data.dimension[item]);
  // };

  // console.log(variables);

  const variables: ScbVariable[] = [];

  for (const variableName of data.extension.px.stub) {
    const scbItem = data.dimension[variableName]
    const scbVariable: ScbVariable = {
      type: "variable",
      id: variableName,
      name: variableName,
      label: scbItem.label,
      elimination: scbItem.extension.elimination,
      show: scbItem.extension.show,
      categoryNoteMandatory: scbItem.extension.categoryNoteMandatory ?? null,
      values: []
    }

    for (const key in scbItem.category.index) {
      // console.log(scbItem.category.note[key])
      const scbVariableValue: ScbVariableValue = {
        type: "variableValue",
        id: key,
        name: key,
        index: scbItem.category.index[key],
        label: scbItem.category.label[key],
      }
      try {
        if (scbItem.category.note[key]) {

          scbVariableValue.note = scbItem.category.note[key]
        }
      } catch {
        // console.info(error)
      }
      // console.log(scbVariableValue)
      scbVariable.values.push(scbVariableValue);
    }

    variables.push(scbVariable);
  }

  tableDetails.variables = variables
  console.log(tableDetails);
  return tableDetails;
  // console.log(JSON.stringify(data.link.data[0].href.replace("px", "json-px").replace("\"", "")));

  // let data2;

  // try {
  //   const response = await fetch (data.link.data[0].href.replace("px", "json-px"), {method: 'GET' });
  //   if (response.ok) {
  //     data2 = await response.json();
  //   } else {
  //     console.warn("Bad response on data2")
  //     return null
  //   }
  // } catch (error) {
  //   console.log(error)
  //   return null
  // }

  // console.log(data2.columns);
}

// getTableDetails("TAB5974", "SCB").then(data => console.log(data));