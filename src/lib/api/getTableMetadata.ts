import type { ApiSelectionItem, ApiTableMetadata } from "./apiTypes";
import getPxWebTableMetadata from "./pxWeb/getPxWebTableMetadata";
import getTrafaTableMetadata from "./trafa/getTrafaTableMetadata";
import { ExternalDataset } from "./utility";

export default async function getTableMetadata(tableId: string, externalDataset: string | undefined, selection: ApiSelectionItem[] = [], language: string): Promise<ApiTableMetadata | null> {
  if (!externalDataset) { return null; }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);

  if (dataset?.api === "PxWeb") {
    return getPxWebTableMetadata(tableId, externalDataset, language);
  } else if (dataset?.api === "Trafa") {
    return getTrafaTableMetadata(tableId, selection, language);
  } else {
    return null; // Unsupported dataset API
  }
}