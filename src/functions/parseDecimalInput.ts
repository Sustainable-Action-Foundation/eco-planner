/**
 * Parses free-text numeric input the way a Swedish user is likely to type it:
 * a decimal comma ("1,5") and grouping whitespace ("18 800", including
 * non-breaking/thin spaces from copy-paste) are accepted. Returns `null` for
 * anything that doesn't parse to a finite number — never `NaN`, which
 * `typeof`-based checks let through and `JSON.stringify` turns into `null`
 * (breaking `isDateValues` server-side).
 */
export function parseDecimalInput(text: string): number | null {
  const normalized = text.replace(/\s/g, "").replaceAll(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
