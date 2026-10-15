/**
 * Canonical form of an email address for lookups, uniqueness and mailed links:
 * trimmed, unwrapped from a `Display Name <addr>` envelope, and lowercased.
 *
 * Every auth handler (signup, login, verify, reset) must pass the address through
 * this before touching the database, so a user who types `Name@Boden.se` into one
 * form and `name@boden.se` into another is the same user everywhere, and the token
 * in a mailed link hashes the same address the link carries.
 */
export function normalizeEmail(raw: string): string {
  const trimmed = raw.trim();
  const wrapped = /<([^<>]*)>\s*$/.exec(trimmed);
  return (wrapped ? wrapped[1] : trimmed).trim().toLowerCase();
}

/** The domain part of a (normalized) email address, or null if there is no `@`. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1);
}
