import type { PxWebCompatTableMetadata } from "../apiTypes";
import { ExternalDataset } from "../utility";
import type { PxWebMetricDimension, PxWebStandardDimension, PxWebTableMetadata, PxWebCompatMetricDimension, PxWebCompatTimeDimension, PxWebCompatRegularDimension, PxWebCompatDimensionValue } from "./pxWebApiV2Types";

export default async function getPxWebTableMetadata(tableId: string, externalDataset: string, language?: string): Promise<PxWebCompatTableMetadata | null> {
  if (!tableId || !externalDataset) {
    console.debug("getPxWebTableMetadata called without required parameters, returning early", { tableId, externalDataset, language });
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
  let data: PxWebTableMetadata;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      data = await response.json() as PxWebTableMetadata;
    } else if (response.status === 429) {
      // Wait 10 seconds and try again
      console.debug(`Received 429 status, retrying in 10 seconds...`, { url, response });
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await getPxWebTableMetadata(tableId, externalDataset, language);
    } else if (response.status === 404) {
      console.error(`${response.status}; No metadata found for table ${tableId} in dataset ${externalDataset}`, { url, response });
      return null;
    } else {
      console.error(`Unusual status ${response.status}; No metadata found for table ${tableId} in dataset ${externalDataset}`, { url, response });
      return null;
    }
  }
  catch (error) {
    console.error("Error fetching table metadata from PxWeb API", { error }, `Query URL: ${url}`);
    return null;
  }

  // Declare the variable that will be returned by the function
  const tableMetadata: PxWebCompatTableMetadata = {
    tableId: tableId,
    metricDimensions: [],
    timeDimensions: [],
    regularDimensions: [],
    language: language,
    api: "PxWeb",
  };

  const metricNames = data.role.metric ?? [];

  const timeNames = data.role.time ?? [];

  // Get all dimensions for the table and add to correct array in tableDetails
  for (const dimensionName in data.dimension) {
    let outputDimension: PxWebCompatMetricDimension | PxWebCompatTimeDimension | PxWebCompatRegularDimension;
    if (metricNames.includes(dimensionName)) {
      outputDimension = {
        type: "metric",
        id: dimensionName,
        name: dimensionName,
        label: data.dimension[dimensionName].label,
        options: [],
      } satisfies PxWebCompatMetricDimension;
    } else if (timeNames.includes(dimensionName)) {
      outputDimension = {
        type: "time",
        id: dimensionName,
        name: dimensionName,
        label: data.dimension[dimensionName].label,
        optional: (data.dimension[dimensionName] as PxWebStandardDimension).extension.elimination ?? false,
        options: [],
      } satisfies PxWebCompatTimeDimension;
    } else {
      outputDimension = {
        type: "dimension",
        id: dimensionName,
        name: dimensionName,
        label: data.dimension[dimensionName].label,
        optional: (data.dimension[dimensionName] as PxWebStandardDimension).extension.elimination ?? false,
        options: [],
      } satisfies PxWebCompatRegularDimension;
    }

    // Add all values for the dimension as options
    if (data.dimension[dimensionName].category.index) {
      for (const valueCode in (data.dimension[dimensionName] as PxWebMetricDimension).category.index) {
        const metricOption: PxWebCompatDimensionValue = {
          type: "dimensionValue",
          value: valueCode,
          index: data.dimension[dimensionName].category.index[valueCode],
          label: data.dimension[dimensionName].category.label?.[valueCode],
        };
        outputDimension.options.push(metricOption);
      }
    } else if (data.dimension[dimensionName].category.label && Object.entries(data.dimension[dimensionName].category.label).length === 1) {
      // Unique case where index may be skipped in favor of only label if there is exactly one value in the dimension
      const metricOption: PxWebCompatDimensionValue = {
        type: "dimensionValue",
        value: Object.keys(data.dimension[dimensionName].category.label)[0],
        index: 0,
        label: data.dimension[dimensionName].category.label[Object.keys(data.dimension[dimensionName].category.label)[0]],
      };
      outputDimension.options.push(metricOption);
    } else {
      console.error(`Dimension "${dimensionName}" has no label with exactly one value AND no index in table details response, which is not allowed`, { data });
      return null;
    }

    if (outputDimension.type === "metric") {
      tableMetadata.metricDimensions.push(outputDimension);
    } else if (outputDimension.type === "time") {
      tableMetadata.timeDimensions.push(outputDimension);
    } else {
      tableMetadata.regularDimensions.push(outputDimension);
    }
  }

  console.debug("Fetched table Metadata from PxWeb API", { tableMetadata });
  return tableMetadata;
}