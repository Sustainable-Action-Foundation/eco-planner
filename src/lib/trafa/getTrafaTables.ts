'use server';

import { StructureItem, TrafaDataResponse, trafaStructureUrl, trafaUrl } from "./trafaTypes";
// import math from "math";

export default async function getTrafaTables(language?: 'sv' | 'en') {
  const structureUrl = new URL(trafaStructureUrl);
  structureUrl.searchParams.append('query', ``);
  if (language) {
    structureUrl.searchParams.append('lang', language);
  }

  // console.log(structureUrl);

  type Table = {
    id: number;
    label: string;
  }

  let data: TrafaDataResponse | null = null;
  // let data: unknown;
  const tables: { tableId: string, label: string }[] = [];

  try {
    const response = await fetch(structureUrl, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      }
    });
    if (response.ok) {
      data = await response.json();
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  // console.log(data);
  if (!data) {
    return null;
  }
  data.StructureItems.forEach((item: StructureItem) => {
    const pushItem: { tableId: string, label: string } = {
      tableId: item.Name,
      // id: item.Id.toString(),
      label: `${item.Label} (${item.Name})`,
    }

    tables.push(pushItem);
  });

  // function LogStructureItems(parentItem: StructureItem[]) {
  //   // if (parentItem.StructureItems) {
  //   parentItem.forEach((item: StructureItem) => {
  //     console.log("");
  //     console.log(item.Label);
  //     console.log(item.Id, item.Name, item.StructureItems);
  //     if (item.StructureItems.length > 0) {
  //       LogStructureItems(item.StructureItems);
  //     }
  //   });
  //   // }
  // }
  // data.StructureItems.map((item: StructureItem) => {
  //   console.log("");
  //   console.log(item.Label);
  //   console.log(item.Id, item.Name);
  //   if (item.StructureItems && item.StructureItems.length > 0) {

  //   }
  // })
  // console.log(tables);
  // LogStructureItems(data.StructureItems);
  // console.log(tables);
  // console.log(data);
  return tables;

};

/* DataTypes
String
Time
Region */

/* Tables with H items
t10011
t10014
t10015
t10018
t0401
t10092
t10093
t10094
t08091
t08092
t04021
t04023
t10021
t10036
t1101
t0603
t10030
t0602
t0604_rt_ar
*/

/* Tables with multiple H items
(8) t0802
(6) t1004
(6) t10061
(5) t0901
(4) t10062
(4) t0808
(4) t1102
(4) t10016
(4) t0501
(4) t06013
(3) t08021
(3) t10039
(3) t06011
(2) t10012
(2) t0604
(2) t04022
(2) t1201
(2) t10023
(2) t10026
(2) t10029
(2) t1203
(2) t10013
(2) t0301
(2) atft
*/

export async function getTrafaTableInfo(tableName: string) {

  console.log("-----------------------------------");
  console.log("------ Get trafa table info -------");
  console.log("-".repeat(Math.floor((21 - tableName.length) / 2)),
    "Table Name:",
    tableName,
    "-".repeat(Math.ceil((21 - tableName.length) / 2)));
  console.log("-----------------------------------");
  // | 1 | 11 | 1 | tableName.length | 1 |
  // 35-1-11-1-1 = 21
  // (21-tableName.length)/2

  const url = new URL(trafaStructureUrl);
  url.searchParams.append('query', `${tableName}`);
  const structureUrl = new URL(trafaStructureUrl);
  structureUrl.searchParams.append('query', ``);
  // console.log(url);

  let tablesData: TrafaDataResponse | null = null;
  try {
    const response = await fetch(structureUrl, {
      method: 'GET',
      headers: {
        // The data is available as either 'application/json' or 'application/xml', JSON is easier to parse
        'Accept': 'application/json',
      }
    });
    if (response.ok) {
      tablesData = await response.json();
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

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
      console.log(data);
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  // data.StructureItems = data.StructureItems.filter((item: StructureItem) => {
  //   if (tablesData?.StructureItems.includes(item) != false) {
  //     console.log(item.Id);
  //     return item;
  //   } 
  // })
  // console.log(data.StructureItems);
  // console.log(tablesData?.StructureItems);
  const tablesDataIds: number[] = tablesData?.StructureItems.map((item: StructureItem) => {
    return item.Id;
  }) || [];


  // type ReducedObject = {
  //   Id: number;
  //   Label: string;
  //   Type: string;
  //   StructureItems: ReducedObject[];
  // }

  // const reducedObjectsList: ReducedObject[] = []

  // function getReducedObject(object: StructureItem): ReducedObject {
  //   const reducedObject: { Id: number; Label: string; Type: string; StructureItems: ReducedObject[] } = {
  //     Id: object.Id,
  //     Label: object.Label,
  //     Type: object.Type ?? '',
  //     StructureItems: [],
  //   }
  //   object.StructureItems.forEach((item: StructureItem) => {
  //     return reducedObject.StructureItems.push(getReducedObject(item));
  //   });
  //   return reducedObject;
  // }

  const filteredDataStructureItems = data.StructureItems.filter((item: StructureItem) => {
    // console.log(item.Id);
    // console.log(tablesDataIds.includes(item.Id));
    // console.log(tablesData?.StructureItems);
    if (!tablesDataIds.includes(item.Id)) {
      // console.log(item.Id);
      // console.log(item);
      // const reducedObject = getReducedObject(item);
      // reducedObjectsList.push(reducedObject);
      return item;
    }
  })

  // async function logReduceObjectsList(reducedObjectsList: ReducedObject[], indentation: number = 0) {
  //   reducedObjectsList.forEach((item: ReducedObject) => {
  //     const indentationString = "  " + "  ".repeat(indentation);

  //     console.log("");

  //     let logString: string = "";
  //     let logStringParts: string[] = [];

  //     logStringParts.push("Id: " + item.Id);
  //     logStringParts.push("Label: " + item.Label);
  //     logStringParts.push("Type: " + item.Type);

  //     for (let i = 0; i < logStringParts.length; i++) {
  //       if (i == 0) {
  //         logString += indentationString.slice(0, -2) + "- " + logStringParts[i] + "\n";
  //       } else if (i == logStringParts.length - 1) {
  //         logString += indentationString + logStringParts[i];
  //       } else {
  //         logString += indentationString + logStringParts[i] + "\n";
  //       }
  //     }
  //     console.log(logString);

  //     if (item.StructureItems && item.StructureItems.length > 0) {
  //       logReduceObjectsList(item.StructureItems, indentation + 1);
  //     }
  //   })
  // }
  // await logReduceObjectsList(reducedObjectsList);

  async function logFilteredDataStructureItems(reducedObjectsList: StructureItem[], indentation: number = 0) {
    reducedObjectsList.forEach((item: StructureItem) => {
      const indentationString = "  " + "  ".repeat(indentation);

      console.log("");

      let logString: string = "";
      const logStringParts: string[] = [];

      logStringParts.push("Id: " + item.Id);
      logStringParts.push("Label: " + item.Label);
      logStringParts.push("Type: " + item.Type);
      logStringParts.push("Name: " + item.Name);
      logStringParts.push("ParentName: " + item.ParentName);

      for (let i = 0; i < logStringParts.length; i++) {
        if (i == 0) {
          logString += indentationString.slice(0, -2) + "- " + logStringParts[i] + "\n";
        } else if (i == logStringParts.length - 1) {
          logString += indentationString + logStringParts[i];
        } else {
          logString += indentationString + logStringParts[i] + "\n";
        }
      }
      console.log(logString);

      if (item.StructureItems.length > 0) {
        // if (item.Type == "H" || item.Type == "D") {
        logFilteredDataStructureItems(item.StructureItems, indentation + 1);
      }
    })
  }

  await logFilteredDataStructureItems(filteredDataStructureItems);

  /* -- On "lägg till historisk data" page -- 
  get all tables
  select table
  get structure items and list them as options
  if item type is H draw as dropdown with D items as options, (could multiple be selected?)
  if a D item is selected, list DV and F items as options
  get names of selected items and add as search queries when fetching data
  must have at least one M item selected to be able to get any data?
  All DV items should be selectable
  F seems to overwrite the DV filters and only one F filter seems to be selectable at a time
  */

  /* H seems to be a header and is not something that can be used as a search parameter
  Examples: t1203|region and t10011|agare 
  */

  // getTrafaTableData("T1203|fordonskm|pastig|personkm|planavg|planutbud|platskm|sittkm|utbudskm|ar|finans|lan|traslag")
  return filteredDataStructureItems;
}

export async function getTrafaTableData(searchQuery: string) {
  // const url = new URL(trafaUrl);
  // let searchParamsString = searchParams.join("\|");
  const url = trafaUrl + "?query=" + searchQuery;
  // searchParams.forEach((param: string) => {
  //   url.searchParams.append('query', param);
  // })
  // url.searchParams.append('query', "t1203|ar|region|lan|03");
  // url.searchParams.append('query');
  console.log(url);
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
      console.log(data);
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }
  // console.log(data);
  return data
}