// No `server-only` marker: pure and shared by server and client components.

/** Longest first or last name accepted (the columns are VARCHAR(191)) */
export const nameMaxLength = 100;

/**
 * What to call a person: "First Last" when the names are set, otherwise the
 * username (the address's local part for link-created accounts). Users are asked
 * for their names at first login, so the fallback is for accounts from before that
 * and for anyone who skipped it.
 */
export function displayName(user: { first_name?: string | null, last_name?: string | null, username: string }): string {
  const name = [user.first_name, user.last_name].filter(part => part?.trim()).join(" ").trim();
  return name || user.username;
}

/**
 * Trims and collapses inner whitespace; null when nothing is left or the result
 * is too long or holds control characters, so callers can 400 on it.
 */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > nameMaxLength || /[\p{Cc}\p{Cf}]/u.test(name)) {
    return null;
  }
  return name;
}
