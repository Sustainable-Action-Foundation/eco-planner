import { PxWebApiV2TableArray } from "@/lib/pxWeb/pxWebApiV2Types";
import { externalDatasetBaseUrls } from "./utility";

/**
 * Returns a list of tables from SCB's API. Returns null on error.
 * @param searchQuery String to search for. Unclear which fields the query is matched against. The search seems to use OR logic, so searching for 'population income' will return tables matching either 'population', 'income', or both. Default is undefined, which will return all tables.
 * @param language Two-letter language code. Default is 'sv'.
 * @param pageSize Initial page size. If the number of tables is larger than this, the function will call itself with the correct page size.
 */
export async function getPxWebTables(externalDataset: string, searchQuery?: string, language: string = 'sv', pageSize: number = 9999) {
  const baseUrl = externalDatasetBaseUrls[externalDataset as keyof typeof externalDatasetBaseUrls] ?? externalDatasetBaseUrls.SCB;
  const url = new URL(`${baseUrl}/tables`);
  
  if (searchQuery) url.searchParams.append('query', searchQuery);
  if (language) url.searchParams.append('lang', language);
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