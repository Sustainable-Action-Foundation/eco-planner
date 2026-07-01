"use server";
import type { TrafaCompatTableMetadata } from "../apiTypes";
import { ExternalDataset } from "../utility";
import getTrafaTables from "./getTrafaTables";
import type { StructureItem, TrafaCompatFilter, TrafaCompatHierarchy, TrafaCompatMetricDimension, TrafaCompatRegularDimension, TrafaCompatDimensionValue, TrafaCompatMetadataDimensionBase, TrafaCompatTimeDimension } from "./trafaTypes";
import { getTrafaSearchQueryString } from "./trafaUtility";

export default async function getTrafaTableMetadata(tableId: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language?: string): Promise<TrafaCompatTableMetadata | null> {
  const searchQuery = getTrafaSearchQueryString(selection);

  const url = new URL('./structure', ExternalDataset.Trafa.baseUrl);
  url.searchParams.append('query', `${tableId}${searchQuery}`);
  if (!language || !ExternalDataset.Trafa.supportedLanguages.includes(language)) {
    language = ExternalDataset.Trafa.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }

  let data: StructureItem;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      },
    });
    if (response.ok) {
      data = await response.json() as StructureItem;
    } else {
      console.error("bad response", response);
      return null;
    }
  }
  catch (error) {
    console.error("Error fetching table structure from Trafa API", { error });
    return null;
  }

  // Filter away all trafa tables from the list of structure items that is fetched from Trafa
  const allTrafaTableNames = await getTrafaTables(null, language).then(result => result?.map(item => item.tableId) ?? null);
  data.StructureItems = data.StructureItems.filter(structureItem => !allTrafaTableNames?.includes(structureItem.Name));

  // Declare the variable that will be returned by this function
  const tableDetails: TrafaCompatTableMetadata = {
    tableId: tableId,
    metricDimensions: [{
      id: "metric",
      type: "metric",
      dataType: "String",
      // TODO: Proper i18n for label
      label: language === "sv" ? "Mått" : "Metric",
      name: "metric",
      options: [],
    }],
    timeDimensions: [],
    regularDimensions: [],
    hierarchies: [],
    language: language,
    api: "Trafa",
  };

  function logNotSupportedDataType(itemType: string, structureItem: StructureItem) {
    console.warn(`This is a ${itemType} with a data type that is not supported ${structureItem.DataType}.\n${itemType}: ${structureItem.DataType} (${tableId} - ${structureItem.Label})`);
  }

  // Helper function for converting structure items from trafa to items that can be used with a more universal structure
  function structureItemToTrafaTableDetailItem(structureItem: StructureItem): TrafaCompatMetricDimension | TrafaCompatTimeDimension | TrafaCompatRegularDimension | TrafaCompatHierarchy | TrafaCompatDimensionValue | TrafaCompatFilter {
    // let returnItem: TrafaCompatMetricDimension | TrafaCompatHierarchy | TrafaCompatDimension | TrafaCompatDimensionValue | TrafaCompatFilter;

    // dimension items
    // if (["M", "D"].includes(structureItem.Type)) {
    if (structureItem.Type === "D") {
      const returnItem: TrafaCompatMetadataDimensionBase | TrafaCompatMetricDimension | TrafaCompatRegularDimension = {
        id: structureItem.Name,
        type: "dimension",
        dataType: structureItem.DataType,
        label: structureItem.Label,
        name: structureItem.Name,
        optional: true,
        description: structureItem.Description,
        options: [],
      };

      // Specify dimension type
      if (structureItem.DataType === "Time") {
        returnItem.type = "time";
      } else {
        returnItem.type = "dimension";
      }

      // Add children to item
      structureItem.StructureItems.forEach((item) => {
        const childItem = structureItemToTrafaTableDetailItem(item);
        if (childItem.type === "dimensionValue" || childItem.type === "filter") {
          returnItem.options.push(childItem);
        } else {
          console.warn(`This dimension has a child that is not a dimension value or filter, which is not supported.\nChild type: ${item.Type}\ndimension: ${returnItem.label} (${tableId} - ${structureItem.Label})`);
        }
      });

      return (returnItem as TrafaCompatMetricDimension | TrafaCompatTimeDimension | TrafaCompatRegularDimension);
    } else if (structureItem.Type === "M") {
      tableDetails.metricDimensions[0].options.push({
        type: "dimensionValue",
        value: structureItem.Name,
        label: structureItem.Label,
        dataType: structureItem.DataType as "String",
      });
      return tableDetails.metricDimensions[0];
    } else if (structureItem.Type === "H") {
      const returnItem: TrafaCompatHierarchy = {
        id: structureItem.Name,
        type: "hierarchy",
        dataType: structureItem.DataType as "String" | "Region",
        label: structureItem.Label,
        name: structureItem.Name,
        description: structureItem.Description,
        children: [],
      };

      if (structureItem.DataType === "Time") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }

      // Add children to item
      structureItem.StructureItems.forEach((item) => {
        const childItem = structureItemToTrafaTableDetailItem(item);
        if (childItem.type === "dimension" || childItem.type === "time") {
          returnItem.children.push(childItem);
        } else {
          console.warn(`This hierarchy has a child that is not a dimension, which is not supported.\nChild type: ${item.Type}\nHierarchy: ${returnItem.label} (${tableId} - ${structureItem.Label})`);
        }
      });

      return returnItem;
    } else if (structureItem.Type === "DV" || structureItem.Type === "F") {
      const returnItem: TrafaCompatDimensionValue | TrafaCompatFilter = {
        type: structureItem.Type === "DV" ? "dimensionValue" : "filter",
        value: structureItem.Name,
        label: structureItem.Label,
        dataType: structureItem.DataType as "String",
      };

      if (structureItem.DataType === "Time" || structureItem.DataType === "Region") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }

      return returnItem;
    } else {
      console.warn(`This structure item has a type that is not supported and will be skipped.\nItem type: ${structureItem.Type}\nItem data type: ${structureItem.DataType}\nItem label: ${structureItem.Label}\nTable ID: ${tableId}`);
      throw new Error(`Unsupported structure item type: ${structureItem.Type}`);
    }
  }

  data.StructureItems.map(item => {
    const pushItem = structureItemToTrafaTableDetailItem(item);

    switch (pushItem?.type) {
      case "metric": {
        // No-op; metric values are added directly as metric dimension options in the structureItemToTrafaTableDetailItem function
        break;
      }
      case "time": {
        tableDetails.timeDimensions.push(pushItem);
        break;
      }
      case "dimension": {
        tableDetails.regularDimensions.push(pushItem);
        break;
      }
      case "hierarchy": {
        tableDetails.hierarchies.push(pushItem);
        break;
      }
      case "dimensionValue":
      case "filter":
      default: {
        console.debug(`Reached an unexpected case regarding trafa StructureItems`);
        // No-op, these types are not top-level dimensions and should not be added to the table details directly
        break;
      }
    }
  });

  return tableDetails;
}

/**
 * dimensions that only have one value
 * t10036 - Fordonsslag underkategori
 * t10036 - Klimatbonusbil
 */

/**
 * Tables with only one metric
 * t0401
 * t0701
 */