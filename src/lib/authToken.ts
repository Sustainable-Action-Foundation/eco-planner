// No `server-only` marker: pure and unit-tested. Only ever imported by route handlers.
import crypto from "node:crypto";

/**
 * Login-link tokens. The token is 32 random bytes as base64url (43 chars) and only
 * its SHA-256 is stored (`LoginTokens.token_hash`), so a database dump or backup
 * never contains a working link.
 */
export function mintToken(): { token: string, hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** The stored form of a token: SHA-256 hex. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** How long a login link stays redeemable. */
export const loginTokenTtlMs = 15 * 60 * 1000;

/** Shape check before any lookup; the full RFC grammar is not the point, excluding junk is. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
