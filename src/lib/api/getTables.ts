import getPxWebTables from "./pxWeb/getPxWebTables";
import getTrafaTables from "./trafa/getTrafaTables";
import { ExternalDataset } from "./utility";

export default async function getTables(externalDataset: string | undefined, locale: string) {
  if (!externalDataset) { return null; }

  const dataset = ExternalDataset.getDatasetByAlternateName(externalDataset);

  if (dataset?.api === "PxWeb") {
    return (await getPxWebTables(externalDataset, locale))?.filter((table) => table != null) ?? null;
  } else if (dataset?.api === "Trafa") {
    return (await getTrafaTables(locale))?.filter((table) => table != null) ?? null;
  } else {
    return null; // Unsupported dataset API
  }
}