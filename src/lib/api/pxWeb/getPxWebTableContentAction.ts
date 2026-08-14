"use server";

import type { ApiSelectionItem } from "../apiTypes";
import { guardExternalApi } from "../guardExternalApi";
import getPxWebTableContent from "./getPxWebTableContent";

/**
 * Public, guarded entry point for PxWeb table content. Client code reaches PxWeb data
 * through here (via getTableContent), so every request is authenticated and
 * rate-limited before the cache-safe core does the fetching and parsing.
 */
export default async function getPxWebTableContentAction(
  tableId: string,
  externalDataset: string,
  selection: ApiSelectionItem[],
  language?: string,
) {
  await guardExternalApi();
  return getPxWebTableContent(tableId, externalDataset, selection, language);
}
