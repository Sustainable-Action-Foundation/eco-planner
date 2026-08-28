import type { JSONValue } from "@/types";
import getPxWebTableContent from "./pxWeb/getPxWebTableContentAction";
import getTrafaTableContent from "./trafa/getTrafaTableContentAction";
import { ExternalDataset } from "./utility";
import type { ApiSelectionItem, ApiTableContent } from "./apiTypes";

export default async function getTableContent(tableId: string, externalDataset: string | undefined, selection: ApiSelectionItem[] | string = [], language?: string): Promise<ApiTableContent | null> {
  if (!externalDataset) { return null; }

  // The selection may be a stringified version of the expected selection array
  if (typeof selection === "string") {
    const intermediateSelection = JSON.parse(selection) as JSONValue;
    if (!Array.isArray(intermediateSelection)) {
      return null;
    } else if (!intermediateSelection.every((item): item is ApiSelectionItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        !Array.isArray(item) &&
        typeof item.variableCode === "string" &&
        Array.isArray(item.valueCodes) &&
        item.valueCodes.every(code => typeof code === "string")
      );
    })) {
      return null;
    }
    selection = intermediateSelection;
  }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);
  if (dataset?.api === "PxWeb") {
    return await getPxWebTableContent(tableId, externalDataset, selection, language);
  } else if (dataset?.api === "Trafa") {
    return await getTrafaTableContent(tableId, selection, language);
  } else {
    return null; // Unsupported dataset API
  }
}