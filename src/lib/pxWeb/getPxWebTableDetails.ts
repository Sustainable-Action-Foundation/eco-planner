import { externalDatasetBaseUrls } from "../api/utility";
import { ApiTableDetails, ScbMetric, ScbTimeVariable, ScbVariable, ScbVariableValue } from "../api/apiTypes";

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
    times: [],
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
  // console.log(data);
  // console.log(data.id);
  // console.log("data dimension:",data.dimension);
  
  // for (const key in data.dimension) {
  //   console.log(key, data.dimension[key]);
  // }

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
  const timeVariables: ScbTimeVariable[] = [];
  const timeCategory = data.dimension.Tid.category

  for (const timeVariableName in timeCategory.index){
    // console.log(timeVariableName)
    const scbItem = data.dimension.Tid;
    // console.log("scb item:", scbItem)
    const scbTimeVariable: ScbTimeVariable = {
      type: "time",
      id: timeVariableName,
      name: timeVariableName,
      label: scbItem.label,
      elimination: scbItem.extension.elimination,
      show: scbItem.extension.show,
      // values: [],
    }

    if (scbTimeVariable.elimination == true) {
      console.log("ELIMINATION IS TRUE", "scbTimeVariable", scbTimeVariable)
    }

    // for (const key in scbItem.category.index) {
    //   // console.log(scbItem.category.note[key])
    //   const scbVariableValue: ScbVariableValue = {
    //     type: "timeVariableValue",
    //     id: key,
    //     name: key,
    //     index: scbItem.category.index[key],
    //     label: scbItem.category.label[key],
    //   }
    //   try {
    //     if (scbItem.category.note[key]) {
    //       scbVariableValue.note = scbItem.category.note[key]
    //     }
    //   } catch {
    //     // console.info(error)
    //   }
    //   // console.log(scbVariableValue)
    //   scbTimeVariable.values.push(scbVariableValue);
    // }
    timeVariables.push(scbTimeVariable)
  }

  tableDetails.times = timeVariables;

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

    if (scbVariable.elimination == true) {
      console.log("ELIMINATION IS TRUE")
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
  return tableDetails;
}