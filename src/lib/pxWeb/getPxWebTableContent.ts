// Use server in order to circumvent CORS issues
'use server';

import { externalDatasetBaseUrls } from "../api/utility.ts";
import { PxWebApiV2TableContent } from "./pxWebApiV2Types.ts";
import { ApiTableContent, ScbTimeVariable } from "../api/apiTypes.ts";

export async function getPxWebTableContent(tableId: string, selection: { variableCode: string, valueCodes: string[] }[], times: ScbTimeVariable[] | undefined, externalDataset: string, language: string = 'sv',) {
  // console.log(selection)
  // for (const item of selection) {
  //   if (item.variableCode == "metric") item.variableCode = "ContentsCode"
  // }

  if (!times) {
    return
  }

  // console.log(selection)

  // selection.push({ variableCode: "Tid", valueCodes: ["2010", "2011", "2012"] })
  // tableId = "TAB4714"

  // Get the base URL for the external dataset, defaulting to SCB
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;

  const url = new URL(`${baseUrl}/tables/${tableId}/data`);
  // const metadataUrl = new URL(`${baseUrl}/tables/TAB4714/metadata`);
  // const tableUrl = new URL(`${baseUrl}/tables/TAB4714`);
  // const url = new URL(`${baseUrl}/data/tab4714`);
  // const url = new URL(`${baseUrl}/TAB4714`);
  url.searchParams.append('lang', language);
  url.searchParams.append('outputformat', 'json-px');
  // url.searchParams.append('outputformat', 'csv');
  // url.searchParams.append('outputformat', 'px');
  // url.searchParams.append('outputformat', 'json');
  // url.searchParams.append('outputformat', 'xlsx');

  const payload = {
    selection: [] as { variableCode: string, valueCodes: string[] }[],
    response: {
      format: "xlsx"
    }
  }

  console.log("payload", payload)

  selection.forEach(item => {

    if (item.variableCode == "metrics" || item.variableCode == "metric") {
      const selectionItem = {
        variableCode: "ContentsCode",
        valueCodes: item.valueCodes,
      }
      payload.selection.push(selectionItem)
    }
    else {
      const selectionItem = {
        variableCode: item.variableCode,
        valueCodes: item.valueCodes,
      }
      payload.selection.push(selectionItem)
    }
  })

  const timeSelectionItem = {
    variableCode: "Tid",
    valueCodes: [] as string[],
  }
  for (const time of times) {

    timeSelectionItem.valueCodes.push(time.id)
  }
  console.log(timeSelectionItem)

  payload.selection.push(timeSelectionItem)
  // const payload = {
  //   selection: [
  //     {
  //       variableCode: "Sektor",
  //       valueCodes: ["010", "030", "040"] // Hela Sverige
  //     },
  //     {
  //       variableCode: "ContentsCode",
  //       valueCodes: ["00000718"]
  //     },
  //     {
  //       variableCode: "SNI2007Naring",
  //       valueCodes: ["A-S", "B", "R"]
  //     },
  //     {
  //       variableCode: "Tid",
  //       valueCodes: ["2024M11", "2024M12"]
  //     }
  //   ],
  //   response: {
  //     format: "xlsx"
  //   }
  // }

  console.log("----PAYLOAD----")
  console.log(JSON.stringify(payload));
  console.log("----URL----")
  console.log(url);

  // const body = JSON.stringify(payload);
  // console.log(body);

  // let data: PxWebApiV2TableContent | null = null;
  let data = null

  // TODO - make this parse in the same format as if it were json
  function parsePxToJson(pxText: string) {
    const json: Record<string, string | string[] | number | number[]> = {};

    const cleanedPxText = pxText.replace("\r", "")
    // Dela upp texten rad för rad
    let lines = cleanedPxText.split(";");
    for (const line of lines) {
      lines[lines.indexOf(line)] = line.split(" \r").join("").split("\r").join("").split("\n").join("");
    }
    lines = lines.filter((entry) => { return entry.trim() != ''; });
    // const data = lines.join(".").split("DATA=")[1].split(" ")
    // console.log(data)

    for (const line of lines) {
      const match = line.match(/^(.+?)=(.+)$/); // Hitta KEY=VALUE;
      // console.log(line);
      if (match) {
        // console.log("match:", match)
        const key = match[1].trim();
        let value = match[2].trim();

        // Ta bort citattecken om de finns
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        json[key] = value;
      }
    }
    json.DATA = (json.DATA as string).split(" ");

    // console.log(typeof json.DATA)
    // console.log(json.DATA)
    // console.log(typeof json.DATA)
    // console.log(json.DATA)
    // console.log(typeof json.DATA as string[])
    if (json.UNITS == "number" || json.UNITS == "antal") {
      json.DATA = (json.DATA as string[]).map(Number);
    }
    // console.log(typeof json.DATA)
    // console.log(json.DATA)

    return json;
  }

  // TODO - make this parse in the same format as if it were json
  function parseCsv(csv: string) {
    const rows = csv.split("\n").map(row => row.split(",")); // Anpassa separatorn vid behov
    const headers = rows.shift()?.map(h => h.replace(/"/g, "").trim()); // Första raden som headers
    // console.log("rows",rows)

    if (!headers) throw new Error("CSV saknar headers!");

    return rows
      .filter(row => row.some(value => value.trim() !== ""))
      .map(row => {
        const obj: Record<string, string | number | null> = {};
        row.forEach((value, index) => {
          let cleanedValue: string | number | null = value.replace(/"/g, "").replace(/\r/g, "").trim(); // Ta bort citattecken och \r
          if (cleanedValue === "..") {
            cleanedValue = null;
          } else if (!isNaN(Number(cleanedValue)) && headers[index] != "Sektor") {
            cleanedValue = Number(cleanedValue); // Konvertera numeriska värden
          }
          obj[headers[index]] = cleanedValue; // Sätter värdena med headers som nycklar
        });
        return obj;
      });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      console.log("----BAD RESPONSE----")
      const errorText = await response.text();
      console.log(errorText);
    }
    console.log("----DATA----")
    console.log("response:", response)
    if (response.ok) {
      const contentType = response.headers.get("Content-Type");
      if (contentType?.includes("application/octet-stream")) {
        const buffer = await response.arrayBuffer();
        // console.log("Received binary data:", buffer);
        const decoder = new TextDecoder("iso-8859-1"); // Om det är i ISO-8859-1 som i din logg
        const decodedText = decoder.decode(buffer);
        // console.log("Decoded text:", decodedText);
        const parsedPx = parsePxToJson(decodedText);
        console.log("parsedPx:", parsedPx)
      }
      else if (contentType?.includes("text/csv")) {
        const csvText = await response.text();
        console.log("csvText:", csvText)
        console.log("parsedCsv:", parseCsv(csvText))
      } else if (contentType?.includes("application/json")) {
        const responseText = await response.json();
        console.log("json:", responseText)
        data = responseText;
      }
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  console.log("returnData:", data);

  function pxWebTableContentToApiTableContent(pxWebTableContent: PxWebApiV2TableContent): ApiTableContent {
    let returnTable: ApiTableContent = {
      id: tableId,
      columns: [],
      data: [],
    };
    for (let column of pxWebTableContent.columns) {
      let pushColumn = {
        id: column.code,
        label: column.text,
        type: column.type === "c" ? "m" : column.type as "t" | "d" | "m",
      }
      returnTable.columns.push(pushColumn);
    }

    for (let data of pxWebTableContent.data) {
      let pushData = {
        key: [] as { columnId: string, value: string }[],
        values: data.values,
      }
      for (let i = 0; i < data.key.length; i++) {
        pushData.key.push({ columnId: returnTable.columns[i].id, value: data.key[i] });
      }
      returnTable.data.push(pushData);
    }

    return returnTable;
  }

  if (data) return pxWebTableContentToApiTableContent(data);
}