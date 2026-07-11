import type { PxWebTableArray } from "@/lib/api/pxWeb/pxWebApiV2Types";
import { ExternalDataset } from "../utility";

/**
 * Returns a list of tables from PxWeb's API. Returns null on error.
 * @param language Two-letter language code. Default is 'sv'.
 * @param pageSize Initial page size. If the number of tables is larger than this, the function will call itself with the correct page size.
 */
export default async function getPxWebTables(externalDataset: string, language?: string, pageSize: number = 9999) {
  // Get the base URL for the external dataset, defaulting to SCB
  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset) ?? ExternalDataset.SCB;
  const url = new URL('./tables', dataset.baseUrl);

  if (!language || !dataset.supportedLanguages.includes(language)) {
    language = dataset.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }
  if (pageSize) url.searchParams.append('pageSize', pageSize.toString());

  let data: PxWebTableArray;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      data = await response.json() as PxWebTableArray;
      // If we didn't get all tables, try again with the correct page size
      if (data?.page?.totalElements > data?.page?.pageSize) {
        return await getPxWebTables(externalDataset, language, data.page.totalElements);
      }
    } else if (response.status === 429) {
      // Wait 10 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await getPxWebTables(externalDataset, language, pageSize);
    } else {
      console.error("bad response", response);
      return null;
    }
  }
  catch (err) {
    console.error("Error fetching tables from PxWeb API", { err });
    return null;
  }

  const result: { tableId: string, label: string }[] = [];
  for (const table of data.tables) {
    result.push({ tableId: table.id, label: `${table.label} (${table.id})` });
  }

  return result;
}