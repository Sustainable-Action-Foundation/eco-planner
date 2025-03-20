import { getDatasetKeysOfApi } from "./utility";
import getTrafaTableContent from "../trafa/getTrafaTableContent";
import getPxWebTableContent from "../pxWeb/getPxWebTableContent";

export default async function getTableContent(tableId: string, externalDataset: string, selection: { variableCode: string, valueCodes: string[] }[] = [], language: "sv" | "en" = "sv") {
  if (getDatasetKeysOfApi("PxWeb").includes(externalDataset)) {
    return getPxWebTableContent(tableId, selection, externalDataset, language);
  }
  else if (externalDataset == "Trafa") {
    return getTrafaTableContent(tableId, selection, language);
  }
}