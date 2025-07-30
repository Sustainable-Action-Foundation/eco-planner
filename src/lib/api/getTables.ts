import getPxWebTables from "../pxWeb/getPxWebTables";
import getTrafaTables from "../trafa/getTrafaTables";
import { getDatasetKeysOfApis } from "./utility";

export default async function getTables(dataSource: string, query: string | null | undefined, locale: string) {
  if (getDatasetKeysOfApis("PxWeb").includes(dataSource)) {
    // TODO - when searching for table id, also return partial matches
    return (await getPxWebTables(dataSource, query ?? undefined, locale))?.filter((table) => table != null) ?? null;
  }
  else if (dataSource == "Trafa") {
    return (await getTrafaTables(query?.length == 0 ? null : query, locale))?.filter((table) => table != null) ?? null;
  }
  else return null;
}