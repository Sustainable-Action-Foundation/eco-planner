import getPxWebTableDetails from "../pxWeb/getPxWebTableDetails";
import getTrafaTableDetails from "../trafa/getTrafaTableDetails";
import { getDatasetKeysOfApis } from "./utility";

export default async function getTableDetails(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language: "sv" | "en" = "sv") {
  if (getDatasetKeysOfApis("PxWeb").includes(externalDataset)) {
    return getPxWebTableDetails(tableId, externalDataset, language);
  }
  else if (externalDataset == "Trafa") {
    return getTrafaTableDetails(tableId, selection, language);
  }
  else return null;
}

/** TODO - if only one metric is available, select it by default (more relevant to queryBuilder)
 * Tables with only one metric:
 * Trafa t0401
 */