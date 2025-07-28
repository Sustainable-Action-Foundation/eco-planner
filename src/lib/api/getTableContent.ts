import getPxWebTableContent from "../pxWeb/getPxWebTableContent";
import getTrafaTableContent from "../trafa/getTrafaTableContent";
import { getDatasetKeysOfApis } from "./utility";

export default async function getTableContent(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language: "sv" | "en" = "sv") {
  if (getDatasetKeysOfApis("PxWeb").includes(externalDataset)) {
    return getPxWebTableContent(tableId, externalDataset, selection, language);
  }
  else if (externalDataset == "Trafa") {
    return getTrafaTableContent(tableId, selection, language);
  } else {
    return null; // No matching dataset found
  }
}