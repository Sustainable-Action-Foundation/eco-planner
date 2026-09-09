"use client";

import type { DatasetData } from "@/lib/api/apiTypes";
import type { TFunction } from "i18next";
import { Trans } from "react-i18next";

/** What {@link getHistoricalDataset} knows about a historical series' origin. */
export type HistoricalSourceInfo = { dataset: DatasetData | null; label: string | null };

/** Whether the series' origin is known well enough to be worth a footnote. */
export function hasHistoricalFootnote(source: HistoricalSourceInfo | null | undefined): boolean {
  return !!(source?.label || source?.dataset);
}

/**
 * Legend name for a historical series. The dataset's own name tends to be a
 * sentence (see the "Grafer" request), so the legend only says "historical data"
 * and points at {@link HistoricalFootnote} with a marker when there is one.
 */
export function historicalSeriesName(t: TFunction, source: HistoricalSourceInfo | null | undefined): string {
  return hasHistoricalFootnote(source) ? t("graphs:common.historical_data_footnoted") : t("common:historical_data");
}

/** The footnote a shortened historical legend refers to: the dataset's full name and where it was fetched from. */
export default function HistoricalFootnote({ source, className }: { source: HistoricalSourceInfo | null | undefined; className?: string }) {
  if (!source || !hasHistoricalFootnote(source)) return null;
  const { label, dataset } = source;

  const sourceLink = dataset ? <a href={dataset.userFacingUrl} target="_blank" rel="noreferrer" /> : null;
  const sourceName = dataset ? dataset.fullName ?? dataset.userFacingUrl : null;

  return (
    <p className={className ?? "margin-0"}>
      {label && sourceLink ?
        <Trans i18nKey="graphs:graph_graph.historical_footnote" components={{ a: sourceLink }} tOptions={{ label, source: sourceName }} />
        : label ?
          <Trans i18nKey="graphs:graph_graph.historical_footnote_no_source" tOptions={{ label }} />
          : sourceLink ?
            <Trans i18nKey="graphs:graph_graph.historical_data_source" components={{ a: sourceLink }} tOptions={{ source: sourceName }} />
            : null}
    </p>
  );
}
