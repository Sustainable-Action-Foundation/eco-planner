// Use server in order to circumvent CORS issues
'use server';

import { getPxWebTableContent } from "../pxWeb/getPxWebTableContent.ts";
import { PxWebApiV2TableContent } from "../pxWeb/pxWebApiV2Types.ts";
import getTrafaTableContent from "../trafa/getTrafaTableContent.ts";
import { externalDatasetBaseUrls } from "./utility.ts";

export async function getTableContent(tableId: string, selection: object[], externalDataset: string, language: string = 'sv',) {
  // Get the base URL for the external dataset, defaulting to SCB
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  const url = new URL(`${baseUrl}/tables/${tableId}/data`);
  url.searchParams.append('lang', language);
  url.searchParams.append('outputformat', 'json-px');

  const body = JSON.stringify({ selection: selection, });

  let data;

  if (externalDataset == "SCB") {
    data = getPxWebTableContent(tableId, selection, externalDataset, language);
  } else if (externalDataset == "Trafa") {
    console.log(selection);
    const searchParams = "t1203|ar|itrfslut"
    data = getTrafaTableContent(searchParams, language as 'sv' | 'en');
  }

  return data;
}

// getTableContent("TAB2946", [
//   { variableCode: "Region", valueCodes: ["00"] },
//   { variableCode: "ArealTyp", valueCodes: ["01"] },
//   { variableCode: "ContentsCode", valueCodes: ["000001O3"] },
//   { variableCode: "Tid", valueCodes: ["BOTTOM(1)"] }
// ], "SCB", "sv").then(data => console.log(data?.data));