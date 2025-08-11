import getPxWebTableContent from "../pxWeb/getPxWebTableContent";
import getTrafaTableContent from "../trafa/getTrafaTableContent";
import { ExternalDataset } from "./utility";

export default async function getTableContent(tableId: string, externalDataset: string | undefined, selection: { variableCode: string, valueCodes: string[] }[] = [], language?: string) {
  if (!externalDataset) { return null; }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);

  if (dataset?.api === "PxWeb") {
    return await getPxWebTableContent(tableId, externalDataset, selection, language);
  } else if (dataset?.api === "Trafa") {
    return await getTrafaTableContent(tableId, selection, language);
  } else {
    return null; // Unsupported dataset API
  }
}