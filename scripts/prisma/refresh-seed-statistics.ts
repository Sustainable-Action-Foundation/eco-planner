/**
 * Refreshes the statistics snapshot the seed reads (see scripts/lib/statisticsSnapshot.ts):
 * every SCB, Energimyndigheten and Trafa series the seed can ask for when it copies the
 * national LEAP scenario into the seeded places, fetched live and written to
 * scripts/prisma/seed/data/statistics-snapshot.json. Commit the result; the seed itself
 * never goes online.
 *
 * Usage (the react-server condition turns the server-only imports into no-ops, as for the seed):
 *   yarn tsx --conditions=react-server scripts/prisma/refresh-seed-statistics.ts             # fetch everything
 *   yarn tsx --conditions=react-server scripts/prisma/refresh-seed-statistics.ts --missing   # only series the snapshot lacks or failed to fetch
 *
 * The statistics APIs answer bursts with 429s, so the series are fetched one at a
 * time with a pause; a run takes several minutes. Progress is saved as it goes.
 */
import fs from "node:fs";
import path from "node:path";
import { fetchExternalVariableData } from "@/functions/recipe/extractors";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { csvToGoalList, parseGoalCsv } from "@/functions/parseGoalCsv";
import getPxWebTableContent from "@/lib/api/pxWeb/getPxWebTableContent";
import getPxWebTableMetadata from "@/lib/api/pxWeb/getPxWebTableMetadata";
import getTrafaTableContent from "@/lib/api/trafa/getTrafaTableContent";
import { ExternalDataset } from "@/lib/api/utility";
import { buildRegionSelection, CuratedRegionKind, findRegionCodeByLabel } from "@/lib/curatedHistoricalData";
import { UnitFlags } from "@/types/enums";
import type { ApiSelectionItem, ApiTableContent, DatasetKeys } from "@/lib/api/apiTypes";
import type { ExternalVariable } from "@/functions/recipe/types";
import { loadSnapshot, requiredStatistics, saveSnapshot, toSnapshotValues } from "../lib/statisticsSnapshot";
import type { SnapshotRequest, StatisticsSnapshot } from "../lib/statisticsSnapshot";
import { LEAP_CSV_PATH, placeAreas } from "./seed/places-geo";
import { seedT } from "./seed/i18n";

/** The unguarded fetchers: no session to rate-limit here, and no cache scope. */
async function getTableContent(tableId: string, dataset: string, selection: ApiSelectionItem[]): Promise<ApiTableContent | null> {
  const api = ExternalDataset.getDatasetByAlternateName(dataset)?.api;
  if (api === "PxWeb") return getPxWebTableContent(tableId, dataset, selection, "sv");
  if (api === "Trafa") return getTrafaTableContent(tableId, selection, "sv");
  return null;
}

/** The request's full selection: curated sources get their region resolved, by table metadata when it is label-prefixed. */
async function resolveSelection(request: SnapshotRequest): Promise<{ dataset: DatasetKeys, tableId: string, selection: ApiSelectionItem[] } | null> {
  if (request.kind === "resolved") return { dataset: request.dataset, tableId: request.tableId, selection: request.selection };
  const { source, area } = request;
  let positional: string | null = null;
  if (source.region.kind === CuratedRegionKind.PxWebLabelPrefix) {
    const metadata = await getPxWebTableMetadata(source.tableId, source.dataset);
    const dimension = metadata?.regularDimensions.find(dimension => dimension.id === (source.region as { variableCode: string }).variableCode);
    positional = dimension ? findRegionCodeByLabel(dimension.options, area.code) : null;
    if (!positional) return null;
  }
  const region = buildRegionSelection(source.region, area, positional);
  if (!region) return null;
  return { dataset: source.dataset, tableId: source.tableId, selection: [...region, ...source.selection] };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetries(request: SnapshotRequest): Promise<{ selection: ApiSelectionItem[], values: Record<string, number>, dataset: DatasetKeys, tableId: string }> {
  const resolved = await resolveSelection(request);
  if (!resolved) throw new Error("no region for the area in the table");
  const variable: ExternalVariable = {
    id: "snapshot",
    name: request.key,
    type: RecipeDataTypes.External,
    dataset: resolved.dataset,
    tableId: resolved.tableId,
    selection: resolved.selection,
    pick: VectorIndexPickerOptions.Default,
    unit: UnitFlags.Missing,
  };
  const delays = [2000, 6000, 15000];
  for (let attempt = 0; ; attempt++) {
    try {
      const fetched = await fetchExternalVariableData(variable, [], getTableContent);
      return { ...resolved, values: toSnapshotValues(fetched.dateValues) };
    }
    catch (err) {
      if (attempt >= delays.length) throw err;
      await sleep(delays[attempt]);
    }
  }
}

async function main() {
  const onlyMissing = process.argv.includes("--missing");
  const t = await seedT();

  const csv = fs.readFileSync(path.join(process.cwd(), LEAP_CSV_PATH));
  const indicators = csvToGoalList(parseGoalCsv(csv.buffer.slice(csv.byteOffset, csv.byteOffset + csv.byteLength))).map(goal => goal.indicatorParameter);
  const requests = requiredStatistics(t, indicators, placeAreas());

  const previous = onlyMissing ? loadSnapshot() : null;
  const snapshot: StatisticsSnapshot = { fetchedAt: new Date().toISOString(), series: { ...(previous?.series ?? {}) }, errors: {} };
  const pending = requests.filter(request => !(previous?.series[request.key]));
  console.info(`${requests.length} series needed, ${pending.length} to fetch`);

  let done = 0;
  for (const request of pending) {
    try {
      const fetched = await fetchWithRetries(request);
      snapshot.series[request.key] = { dataset: fetched.dataset, tableId: fetched.tableId, selection: fetched.selection, values: fetched.values };
      console.info(`${request.key}: ${Object.keys(fetched.values).length} år`);
    }
    catch (err) {
      snapshot.series[request.key] = null;
      snapshot.errors[request.key] = err instanceof Error ? err.message : String(err);
      console.error(`${request.key}: ${snapshot.errors[request.key]}`);
    }
    done++;
    if (done % 25 === 0) saveSnapshot(snapshot);
    await sleep(300);
  }
  saveSnapshot(snapshot);
  const failed = Object.keys(snapshot.errors).length;
  console.info(`Klart: ${Object.values(snapshot.series).filter(Boolean).length} serier i ögonblicksbilden, ${failed} misslyckade`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
