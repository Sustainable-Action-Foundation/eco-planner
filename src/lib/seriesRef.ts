/**
 * A reference to a browsable historical series, as carried in links such as
 * `/goal/create?historical=curated:wind-capacity/capacity`. Today the only
 * kind is a curated catalog entry (resolved per org geo area); a data lab
 * publishing its own series would add a kind here (e.g. a stored data series
 * by id) and teach `resolveSeriesRef` to resolve it.
 */

export const SeriesRefKind = {
  Curated: "CURATED",
} as const;
export type SeriesRefKind = (typeof SeriesRefKind)[keyof typeof SeriesRefKind];

export type SeriesRef = {
  kind: typeof SeriesRefKind.Curated;
  entryKey: string;
  seriesKey: string;
};

/** Catalog keys are kebab-case identifiers, which keeps the serialized ref URL-safe. */
const KEY_PATTERN = /^[a-z0-9-]+$/;

/** `curated:wind-capacity/capacity` */
export function formatSeriesRef(ref: SeriesRef): string {
  return `${ref.kind.toLowerCase()}:${ref.entryKey}/${ref.seriesKey}`;
}

/** Inverse of {@link formatSeriesRef}; null for anything that isn't a well-formed ref. */
export function parseSeriesRef(raw: string | string[] | null | undefined): SeriesRef | null {
  if (typeof raw !== "string") return null;

  const separator = raw.indexOf(":");
  if (separator === -1) return null;
  const kind = raw.slice(0, separator).toUpperCase();
  const rest = raw.slice(separator + 1);

  if (kind === SeriesRefKind.Curated) {
    const [entryKey, seriesKey, ...extra] = rest.split("/");
    if (extra.length > 0 || !entryKey || !seriesKey || !KEY_PATTERN.test(entryKey) || !KEY_PATTERN.test(seriesKey)) return null;
    return { kind: SeriesRefKind.Curated, entryKey, seriesKey };
  }

  return null;
}
