import { PxWebApiV2TableArray } from "@/lib/pxWeb/pxWebApiV2Types";
import { externalDatasets } from "../api/utility";

/**
 * Returns a list of tables from PxWeb's API. Returns null on error.
 * @param searchQuery String to search for. Unclear which fields the query is matched against. The search seems to use OR logic, so searching for 'population income' will return tables matching either 'population', 'income', or both. Default is undefined, which will return all tables.
 * @param language Two-letter language code. Default is 'sv'.
 * @param pageSize Initial page size. If the number of tables is larger than this, the function will call itself with the correct page size.
 */
export default async function getPxWebTables(externalDataset: string, searchQuery?: string, language?: string, pageSize: number = 9999) {
  // Get the base URL for the external dataset, defaulting to SCB
  const baseUrl = externalDatasets[externalDataset]?.baseUrl ?? externalDatasets.SCB?.baseUrl;
  const url = new URL('./tables', baseUrl);

  if (searchQuery) url.searchParams.append('query', searchQuery);
  if (!language || !externalDatasets[externalDataset]?.supportedLanguages.includes(language)) {
    language = externalDatasets[externalDataset]?.supportedLanguages[0];
  }
  if (language) {
    url.searchParams.append('lang', language);
  }
  if (pageSize) url.searchParams.append('pageSize', pageSize.toString());

  let data: PxWebApiV2TableArray;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (response.ok) {
      data = await response.json();
      // If we didn't get all tables, try again with the correct page size
      if (data?.page?.totalElements > data?.page?.pageSize) {
        return await getPxWebTables(externalDataset, searchQuery, language, data.page.totalElements);
      }
    } else if (response.status == 429) {
      // Wait 10 seconds and try again
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await getPxWebTables(externalDataset, searchQuery, language, pageSize);
    } else {
      console.log("bad response", response)
      return null;
    }
  } catch (error) {
    console.log(error);
    return null;
  }

  const result: { tableId: string, label: string }[] = [];
  for (const table of data.tables) {
    result.push({ tableId: table.id, label: `${table.label} (${table.id})` });
  }

  return result;
}