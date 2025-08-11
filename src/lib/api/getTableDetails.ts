import getPxWebTableDetails from "../pxWeb/getPxWebTableDetails";
import getTrafaTableDetails from "../trafa/getTrafaTableDetails";
import { ExternalDataset } from "./utility";

export default async function getTableDetails(tableId: string, externalDataset: string | undefined, selection: { variableCode: string, valueCodes: string[] }[] = [], language: string) {
  if (!externalDataset) { return null; }
  if (ExternalDataset[externalDataset as keyof typeof ExternalDataset]) {
    const dataset = ExternalDataset[externalDataset as keyof typeof ExternalDataset];
    if (!dataset || !(typeof dataset === "object") || !("api" in dataset)) {
      return null;
    }
    if (dataset.api === "PxWeb") {
      return getPxWebTableDetails(tableId, externalDataset, language);
    } else if (dataset.api === "Trafa") {
      return getTrafaTableDetails(tableId, selection, language);
    } else {
      return null; // Unsupported dataset API
    }
  } else {
    return null; // Invalid dataset name
  }
}


/** TODO - if only one metric is available, select it by default (more relevant to queryBuilder)
 * Tables with only one metric:
 * Trafa t0401
 */