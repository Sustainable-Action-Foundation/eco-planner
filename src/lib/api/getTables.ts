import getPxWebTables from "../pxWeb/getPxWebTables";
import getTrafaTables from "../trafa/getTrafaTables";
import { getDatasetKeysOfApis } from "./utility";

export default async function getTables(dataSource: string, query: string | null | undefined, locale: "sv" | "en") {
  if (getDatasetKeysOfApis("PxWeb").includes(dataSource)) {
    // TODO - when searching for table id, also return partial matches
    return getPxWebTables(dataSource, query ?? undefined, locale);
  }
  else if (dataSource == "Trafa") {
    return getTrafaTables(query?.length == 0 ? null : query, locale);
  }
  else return null;
}