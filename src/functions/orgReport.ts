// No `server-only` marker: pure, shared by the report page, its loader and the landing's links, and unit tested.
import { OrgView, orgViewParam } from "@/functions/orgLanding";
import { IterationStatus } from "@/lib/prisma/generated";

/** The search param that adds the unlisted goals to the report (`?unlisted=true`); only for those who can edit them */
export const reportUnlistedParam = "unlisted";
/** The search param that opens the print dialog once the report has loaded (`?print=true`) */
export const reportPrintParam = "print";

/**
 * An org's report: its whole content as one printable document.
 * @param options.view The public version, for those who also have the working view; left out for the viewer's own
 * @param options.unlisted Unlisted goals included
 * @param options.print Open the print dialog on arrival
 */
export function orgReportPath(orgId: string, options: { view?: OrgView, unlisted?: boolean, print?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (options.view === OrgView.Public) params.set(orgViewParam, OrgView.Public.toLowerCase());
  if (options.unlisted) params.set(reportUnlistedParam, "true");
  if (options.print) params.set(reportPrintParam, "true");
  const query = params.toString();
  return `/org/${encodeURIComponent(orgId)}/report${query ? `?${query}` : ""}`;
}

/**
 * The version a roadmap is shown as in lists, counts and the report: its latest published
 * version, or its newest draft when nothing is published. Null without versions. Pass only
 * the versions the viewer may see; a draft among them is one they can write to.
 */
export function currentIteration<T extends { version: number, status: IterationStatus }>(iterations: readonly T[]): T | null {
  let current: T | null = null;
  for (const iteration of iterations) {
    const published = iteration.status === IterationStatus.PUBLISHED;
    const currentPublished = current?.status === IterationStatus.PUBLISHED;
    if (!current || (published && !currentPublished) || (published === currentPublished && iteration.version > current.version)) {
      current = iteration;
    }
  }
  return current;
}

/**
 * The years a compact table of a series shows: all of them while they fit, otherwise the
 * first and last year with the round years between them (every fifth, or every tenth when
 * those are still too many). Years the caller wants in regardless (`always`, e.g. the latest
 * year with historical data) are added on top.
 */
export function keyYears(years: Iterable<number>, options: { limit?: number, always?: Iterable<number> } = {}): number[] {
  const limit = Math.max(2, options.limit ?? 7);
  const sorted = [...new Set(years)].filter(Number.isFinite).sort((a, b) => a - b);

  let chosen = sorted;
  if (sorted.length > limit) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const between = (step: number) => sorted.filter(year => year > first && year < last && year % step === 0);
    chosen = [first, last];
    for (const step of [5, 10, 25, 50, 100]) {
      const round = between(step);
      if (round.length + 2 <= limit) {
        chosen = [first, ...round, last];
        break;
      }
    }
  }

  return [...new Set([...chosen, ...[...(options.always ?? [])].filter(Number.isFinite)])].sort((a, b) => a - b);
}

/**
 * A CSS string literal holding `text`, for generated content (`content: "..."`) inside an
 * inline `<style>`. Everything but letters, digits and spaces is written as a hex escape, so
 * no character of the text can end the string, the rule or the style element.
 */
export function cssStringLiteral(text: string): string {
  let escaped = "";
  for (const character of text) {
    escaped += /[\p{L}\p{N} ]/u.test(character)
      ? character
      // The trailing space ends the escape, so a following hex digit isn't read as part of it
      : `\\${(character.codePointAt(0) ?? 0xfffd).toString(16)} `;
  }
  return `"${escaped}"`;
}
