import { all } from "mathjs";
import getTrafaTables, { getTrafaTableInfo } from "./getTrafaTables";
import { StructureItem, trafaStructureUrl } from "./trafaTypes";
import { ApiTableDetails, TrafaFilter, TrafaHierarchy, TrafaMetric, TrafaVariable, TrafaVariableValue } from "../api/apiTypes";
import { Type } from "typescript";
import { table } from "console";


export default async function getTrafaTableDetails(tableId: string, language: "sv" | "en" = 'sv') {
  const tableName = tableId;
  // console.log("-----------------------------------");
  // console.log("------ Get trafa table info -------");
  // console.log("-".repeat(Math.floor((21 - tableName.length) / 2)),
  //   "Table Name:",
  //   tableName,
  //   "-".repeat(Math.ceil((21 - tableName.length) / 2)));
  // console.log("-----------------------------------");

  const url = new URL(trafaStructureUrl);
  url.searchParams.append('query', `${tableName}`);

  let data: StructureItem;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      }
    });
    if (response.ok) {
      data = await response.json();
      // console.log(data);
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  const allTrafaTableNames = await getTrafaTables().then(result => result?.map(item => item.tableId) ?? null)
  // console.log(allTrafaTableNames);

  data.StructureItems = data.StructureItems.filter(structureItem => !allTrafaTableNames?.includes(structureItem.Name))

  // await getTrafaTableInfo(tableId)

  // console.log(data);
  const tableDetails: ApiTableDetails = {
    id: tableId,
    metrics: [],
    hierarchies: [],
    variables: [],
    language: language,
  }

  function structureItemToTrafaTableDetailItem(structureItem: StructureItem, tableDetailType: string): TrafaMetric | TrafaHierarchy | TrafaVariable | TrafaVariableValue | TrafaFilter {


    let returnItem: any;

    if (tableDetailType == "M") {
      returnItem = {} as TrafaMetric
    } else if (tableDetailType == "H") {
      returnItem = {} as TrafaHierarchy
      returnItem.children = []
    } else if (tableDetailType == "D") {
      returnItem = {} as TrafaVariable
      returnItem.values = []
    } else if (tableDetailType == "DV") {
      returnItem = {} as TrafaVariableValue
    } else if (tableDetailType == "F") {
      returnItem = {} as TrafaFilter
    }

    returnItem.trafaId = structureItem.Id;
    returnItem.dataType = structureItem.DataType
    returnItem.label = structureItem.Label
    returnItem.name = structureItem.Name
    returnItem.parentName = structureItem.ParentName
    returnItem.selected = structureItem.Selected
    returnItem.option = structureItem.Option
    returnItem.description = structureItem.Description

    // console.log(returnItem)
    if ('children' in returnItem && returnItem.children) {
      structureItem.StructureItems.forEach((item) => {
        // console.log('children' in returnItem, typeof returnItem)
        returnItem.children.push(structureItemToTrafaTableDetailItem(item, item.Type));
      });
    }

    return returnItem;
  }

  data.StructureItems.map(item => {
    const pushItem = structureItemToTrafaTableDetailItem(item, item.Type)

    // console.log(pushItem);

    if (item.Type == "M") {
      tableDetails.metrics.push(pushItem);
    }
    if (item.Type == "H") {
      tableDetails.hierarchies.push(pushItem);
    }
    if (item.Type == "D") {
      tableDetails.variables.push(pushItem);
    }
  })

  // console.log(tableDetails);
  // console.log(data.StructureItems.filter(item => item.Type == "H"));

  // console.log(data);
  // console.log(data.StructureItems.length+", "+ (tableDetails.metrics.length + tableDetails.hierarchies.length + tableDetails.variables.length))

  console.log(tableDetails.metrics);
  console.log(tableDetails.hierarchies);
  console.log(tableDetails.variables);

  return tableDetails;
}