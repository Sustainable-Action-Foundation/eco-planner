import { ApiTableDetails, TrafaFilter, TrafaHierarchy, TrafaMetric, TrafaVariable, TrafaVariableValue } from "../api/apiTypes";
import { externalDatasets } from "../api/utility";
import getTrafaTables from "./getTrafaTables";
import { StructureItem } from "./trafaTypes";
import { getTrafaSearchQueryString } from "./trafaUtility";

export default async function getTrafaTableDetails(tableId: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language: "sv" | "en" = "sv") {
  const searchQuery = getTrafaSearchQueryString(selection);

  const url = new URL(`${externalDatasets.Trafa.baseUrl}/structure`);
  url.searchParams.append('query', `${tableId}${searchQuery}`);
  language = "sv"
  if (language) url.searchParams.append("lang", language);

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
      data = await response.json();
    } else {
      console.log("bad response", response);
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  // Filter away all trafa tables from the list of structure items that is fetched from Trafa
  const allTrafaTableNames = await getTrafaTables(null, language).then(result => result?.map(item => item.tableId) ?? null);
  data.StructureItems = data.StructureItems.filter(structureItem => !allTrafaTableNames?.includes(structureItem.Name));

  // Declare the variable that will be returned by this function
  const tableDetails: ApiTableDetails = {
    id: tableId,
    metrics: [],
    hierarchies: [],
    variables: [],
    times: [],
    language: language,
  }

  function logNotSupportedDataType(itemType: string, structureItem: StructureItem) {
    console.warn(`This is a ${itemType} with a data type that is not supported ${structureItem.DataType}.\n${itemType}: ${structureItem.DataType} (${tableId} - ${structureItem.Label})`);
  }

  // Helper function for converting structure items from trafa to items that can be used with a more universal structure
  function structureItemToTrafaTableDetailItem(structureItem: StructureItem, tableDetailType: string): TrafaMetric | TrafaHierarchy | TrafaVariable | TrafaVariableValue | TrafaFilter {
    const returnItem: TrafaMetric | TrafaHierarchy | TrafaVariable | TrafaVariableValue | TrafaFilter = {} as TrafaMetric | TrafaHierarchy | TrafaVariable | TrafaVariableValue | TrafaFilter;

    // Assign values depending on item type
    if (tableDetailType == "M") {
      returnItem.type = "metric";
      if (structureItem.DataType == "Time" || structureItem.DataType == "Region") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }
      else if (structureItem.DataType == "String") { }
    } else if (tableDetailType == "H") {
      (returnItem as TrafaHierarchy).children = [];
      returnItem.type = "hierarchy";
      if (structureItem.DataType == "Time") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }
    } else if (tableDetailType == "D" && structureItem.DataType != "Time") {
      (returnItem as TrafaVariable).values = [];
      (returnItem as TrafaVariable).optional = true;
      returnItem.type = "variable";
    } else if (tableDetailType == "D" && structureItem.DataType == "Time") {
      returnItem.type = "time";
    } else if (tableDetailType == "DV") {
      returnItem.type = "variableValue";
      if (structureItem.DataType == "Time" || structureItem.DataType == "Region") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }
    } else if (tableDetailType == "F") {
      returnItem.type = "filter";
      if (structureItem.DataType == "Time" || structureItem.DataType == "Region") {
        logNotSupportedDataType(returnItem.type, structureItem);
      }
    }

    // Assign common values
    returnItem.trafaId = structureItem.Id;
    returnItem.id = structureItem.Name;
    returnItem.dataType = structureItem.DataType;
    returnItem.label = structureItem.Label; // TODO - This label needs to be manually translated when internationalization is implemented
    returnItem.name = structureItem.Name;
    returnItem.parentName = structureItem.ParentName;
    returnItem.selected = structureItem.Selected;
    returnItem.option = structureItem.Option;
    returnItem.description = structureItem.Description;

    // Push children to item depending on item type
    if ('children' in returnItem && returnItem.children) {
      structureItem.StructureItems.forEach((item) => {
        if (returnItem.children) {
          try {
            returnItem.children.push(structureItemToTrafaTableDetailItem(item, item.Type) as TrafaVariable);
          } catch (error) {
            console.log(error);
          }
        }
      });
    }
    if ('values' in returnItem && returnItem.values) {
      structureItem.StructureItems.forEach((item) => {
        if (returnItem.values) {
          try {
            returnItem.values.push((structureItemToTrafaTableDetailItem(item, item.Type) as TrafaVariable | TrafaVariableValue | TrafaFilter));
          } catch (error) {
            console.log(error);
          }
        }
      });

      if (returnItem.values.length <= 1) {
        console.warn("This variable only has one value, which is not expected.\nVariable: " + returnItem.label);
      }
    }

    return returnItem;
  }

  data.StructureItems.map(item => {
    const pushItem = structureItemToTrafaTableDetailItem(item, item.Type);

    try {
      if (item.Type == "M") {
        tableDetails.metrics.push((pushItem as TrafaMetric));
      }
      if (item.Type == "H") {
        tableDetails.hierarchies?.push((pushItem as TrafaHierarchy));
      }
      if (item.Type == "D" && item.DataType != "Time") {
        tableDetails.variables.push((pushItem as TrafaVariable));
      }
      if (item.Type == "D" && item.DataType == "Time") {
        tableDetails.times.push((pushItem as TrafaVariable));
      }
    } catch (error) {
      console.log(error);
    }
  });

  if (tableDetails.metrics.length <= 1) {
    console.warn("This table only has one metric, which is not expected.\nTable: " + tableId);
  }

  return tableDetails;
}

/**
 * Variables that only have one value
 * t10036 - Fordonsslag underkategori
 * t10036 - Klimatbonusbil
 */

/**
 * Tables with only one metric
 * t0401
 * t0701
 */