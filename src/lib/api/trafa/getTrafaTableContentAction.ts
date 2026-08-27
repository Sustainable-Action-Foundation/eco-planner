"use server";

import type { ApiSelectionItem } from "../apiTypes";
import { guardExternalApi } from "../guardExternalApi";
import getTrafaTableContent from "./getTrafaTableContent";

/**
 * Public, guarded entry point for Trafa table content. Client code reaches Trafa data
 * through here (via getTableContent), so every request is authenticated and
 * rate-limited before the cache-safe core does the fetching and parsing.
 */
export default async function getTrafaTableContentAction(
  tableId: string,
  selection: ApiSelectionItem[],
  language?: string,
) {
  await guardExternalApi();
  return getTrafaTableContent(tableId, selection, language);
}
