// Use server in order to circumvent CORS issues
'use server';

import { externalDatasetBaseUrls } from "../api/utility.ts";
import { PxWebApiV2TableContent } from "./pxWebApiV2Types.ts";

export async function getPxWebTableContent(tableId: string, selection: { variableCode: string, valueCodes: string[] }[], externalDataset: string, language: string = 'sv',) {
  // Get the base URL for the external dataset, defaulting to SCB
  // console.log(selection)
  // for (const item of selection) {
  //   if (item.variableCode == "metric") item.variableCode = "ContentsCode"
  // }

  // console.log(selection)

  // selection.push({ variableCode: "Tid", valueCodes: ["2010", "2011", "2012"] })
  tableId = "TAB4714"

  let baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  baseUrl = "https://api.scb.se/ov0104/v2beta/api/v2"
  // baseUrl = "https://api.scb.se/OV0104/v1/doris/sv/ssd"
  // const url = new URL(`${baseUrl}/tables/tab4714/metadata`);

  const url = new URL(`${baseUrl}/tables/TAB4714/data`);
  const metadataUrl = new URL(`${baseUrl}/tables/TAB4714/metadata`);
  const tableUrl = new URL(`${baseUrl}/tables/TAB4714`);
  // const url = new URL(`${baseUrl}/data/tab4714`);
  // const url = new URL(`${baseUrl}/TAB4714`);
  // url.searchParams.append('lang', language);
  // url.searchParams.append('outputformat', 'json-px');

  const payload = {
    selection: [
      {
        variableCode: "Sektor",
        valueCodes: ["010"] // Hela Sverige
      },
      {
        variableCode: "ContentsCode",
        valueCodes: ["00000718"]
      },
      {
        variableCode: "SNI2007Naring",
        valueCodes: ["A-S"]
      },
      {
        variableCode: "Tid",
        valueCodes: ["2024M12"]
      }
    ],
    response: {
      format: "json-px"
    }
  }
  // const payload = {
  //   query: selection.map(item => ({
  //     code: item.variableCode,
  //     selection: {
  //       filter: "item",
  //       values: item.valueCodes
  //     }
  //   })),
  //   response: {
  //     format: "json"
  //   }
  // };

  console.log("----PAYLOAD----")
  console.log(JSON.stringify(payload));
  console.log("----URL----")
  console.log(url);

  const body = JSON.stringify(payload);
  // console.log(body);

  let data: PxWebApiV2TableContent | null = null;

  try {
    const response = await fetch(tableUrl, {
      method: "GET"
    })
    console.log("----TABLE----")
    if (!response.ok) {
      console.log("bad table response")
    }

    console.log(response)
  } catch (error) {
    console.log(error)
  }

  try {
    const response = await fetch(metadataUrl, {
      method: 'GET'
    })
    if (!response.ok) {
      // data = await response.json();
      console.log("bad metadata response")
      // If we didn't get all tables, try again with the correct page size
    }
    console.log("----METADATA----")
    console.log(response)
  } catch (error) {
    console.log(error);
    // return null;
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
    console.log(response)
    console.log(response.headers)
    console.log(response.status)
    console.log(await response.text())
    // console.log(await response.json())
  } catch (error) {
    console.log(error);
    return null;
  }

  // try {
  //   const response = await fetch(url, {
  //     method: 'POST',
  //     body: body,
  //     headers: { 'Content-Type': 'application/json' }
  //   });
  //   if (response.ok) {
  //     data = await response.json();
  //     console.log("response ok. data:", data)
  //   } else if (response.status == 429) {
  //     console.log("Too many requests, waiting 10 seconds and trying again");
  //     // If hit with "429: Too many requests", wait 10 seconds and try again
  //     await new Promise(resolve => setTimeout(resolve, 10000));
  //     return await getPxWebTableContent(tableId, selection, externalDataset, language);
  //   } else {
  //     console.log("bad response", response)
  //     return null;
  //   }
  // } catch (error) {
  //   console.log(error);
  //   return null;
  // }

  console.log(data);
  return data;
}

// getTableContent("TAB2946", [
//   { variableCode: "Region", valueCodes: ["00"] },
//   { variableCode: "ArealTyp", valueCodes: ["01"] },
//   { variableCode: "ContentsCode", valueCodes: ["000001O3"] },
//   { variableCode: "Tid", valueCodes: ["BOTTOM(1)"] }
// ], "SCB", "sv").then(data => console.log(data?.data));