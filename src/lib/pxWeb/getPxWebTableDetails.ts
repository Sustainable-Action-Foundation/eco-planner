import { PxWebApiV2TableDetails } from "./pxWebApiV2Types";
import { externalDatasetBaseUrls } from "../api/utility";

export async function getPxWebTableDetails(tableId: string, externalDataset: string, language: string = 'sv') {
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  const url = new URL(`${baseUrl}/tables/${tableId}/metadata`);
  console.log(url);
  url.searchParams.append('lang', language);

  let data: PxWebApiV2TableDetails;

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
  // console.log(data.variables);
  return data;
}

// getTableDetails("TAB5974", "SCB").then(data => console.log(data));