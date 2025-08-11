import getPxWebTableContent from "../pxWeb/getPxWebTableContent";
import getTrafaTableContent from "../trafa/getTrafaTableContent";
import { ExternalDataset } from "./utility";

export default async function getTableContent(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language?: string) {
  if (ExternalDataset[externalDataset as keyof typeof ExternalDataset]) {
    const dataset = ExternalDataset[externalDataset as keyof typeof ExternalDataset];
    if (!dataset || !(typeof dataset === "object") || !("api" in dataset)) {
      return null;
    }
    if (dataset.api === "PxWeb") {
      return getPxWebTableContent(tableId, externalDataset, selection, language);
    } else if (dataset.api === "Trafa") {
      return getTrafaTableContent(tableId, selection, language);
    } else {
      return null; // Unsupported dataset API
    }
  } else {
    return null; // Invalid dataset name
  }
}