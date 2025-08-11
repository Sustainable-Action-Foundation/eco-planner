import getPxWebTables from "../pxWeb/getPxWebTables";
import getTrafaTables from "../trafa/getTrafaTables";
import { ExternalDataset } from "./utility";

export default async function getTables(externalDataset: string | undefined, query: string | null | undefined, locale: string) {
  if (!externalDataset) { return null; }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);

  if (dataset?.api === "PxWeb") {
    return (await getPxWebTables(externalDataset, query ?? undefined, locale))?.filter((table) => table != null) ?? null;
  } else if (dataset?.api === "Trafa") {
    return (await getTrafaTables(query?.length == 0 ? null : query, locale))?.filter((table) => table != null) ?? null;
  } else {
    return null; // Unsupported dataset API
  }
}