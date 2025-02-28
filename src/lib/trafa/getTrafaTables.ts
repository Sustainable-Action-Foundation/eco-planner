'use server';

import { StructureItem, TrafaDataResponse, trafaStructureUrl } from "./trafaTypes";
// import math from "math";

export default async function getTrafaTables(language?: 'sv' | 'en') {
  const structureUrl = new URL(trafaStructureUrl);
  structureUrl.searchParams.append('query', ``);
  if (language) {
    structureUrl.searchParams.append('lang', language);
  }

  // console.log(structureUrl);



  let data: TrafaDataResponse | null = null;
  // let data: unknown;
  const tables: StructureItem[] = [];

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
    const pushItem: StructureItem = {
      Id: item.Id,
      DataType: item.DataType,
      Label: item.Label,
      FullLabel: item.FullLabel,
      Name: item.Name,
      ParentName: item.ParentName,
      FullName: item.FullName,
      Type: item.Type,
      Selected: item.Selected,
      Option: item.Option,
      Description: item.Description,
      UniqueId: item.UniqueId,
      ActiveFrom: item.ActiveFrom,
      StructureItems: item.StructureItems,
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
  // LogStructureItems(tables);
  // console.log(tables);
  // console.log(data);
  return data;

};

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

  // console.log(url);

  const tablesData = await getTrafaTables();

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
      let logStringParts: string[] = [];

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
  if item type is H draw as dropdown with D items as options
  if a D item is selected, list DV, F and M items as options
  get names of selected items and add as search queries when fetching data
  */
}