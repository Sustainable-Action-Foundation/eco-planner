import getPxWebTables from "../pxWeb/getPxWebTables";
import getTrafaTables from "../trafa/getTrafaTables";
import { ExternalDataset } from "./utility";

export default async function getTables(externalDataset: string | undefined, query: string | null | undefined, locale: string) {
  if (!externalDataset) { return null; }
  if (ExternalDataset[externalDataset as keyof typeof ExternalDataset]) {
    const dataset = ExternalDataset[externalDataset as keyof typeof ExternalDataset];
    if (!dataset || !(typeof dataset === "object") || !("api" in dataset)) {
      return null;
    }
    if (dataset.api === "PxWeb") {
      return (await getPxWebTables(externalDataset, query ?? undefined, locale))?.filter((table) => table != null) ?? null;
    } else if (dataset.api === "Trafa") {
      return (await getTrafaTables(query?.length == 0 ? null : query, locale))?.filter((table) => table != null) ?? null;
    } else {
      return null; // Unsupported dataset API
    }
  } else {
    return null; // Invalid dataset name
  }
}