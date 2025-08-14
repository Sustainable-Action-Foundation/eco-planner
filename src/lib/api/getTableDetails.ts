import getPxWebTableDetails from "../pxWeb/getPxWebTableDetails";
import getTrafaTableDetails from "../trafa/getTrafaTableDetails";
import { ExternalDataset } from "./utility";

export default async function getTableDetails(tableId: string, externalDataset: string | undefined, selection: { variableCode: string, valueCodes: string[] }[] = [], language: string) {
  if (!externalDataset) { return null; }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);

  if (dataset?.api === "PxWeb") {
    return getPxWebTableDetails(tableId, externalDataset, language);
  } else if (dataset?.api === "Trafa") {
    return getTrafaTableDetails(tableId, selection, language);
  } else {
    return null; // Unsupported dataset API
  }
}


/** TODO - if only one metric is available, select it by default (more relevant to queryBuilder)
 * Tables with only one metric:
 * Trafa t0401
 */