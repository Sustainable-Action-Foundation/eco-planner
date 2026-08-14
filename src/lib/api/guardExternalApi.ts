import "server-only";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { consumeToken } from "@/lib/rateLimit";

/**
 * Per-user budget for outbound requests to third-party statistics APIs (SCB/PxWeb,
 * Trafa). Interactive table/dimension browsing stays well under this; the cap exists
 * to bound scripted amplification (and its cost) through our server.
 */
const EXTERNAL_API_BUDGET = { capacity: 60, refillPerSecond: 1 } as const; // ~60/min sustained, burst 60

/** Thrown when a caller is not logged in. */
export class ExternalApiAuthError extends Error {
  constructor() {
    super("You must be logged in to query external data sources.");
    this.name = "ExternalApiAuthError";
  }
}

/** Thrown when a caller exceeds their external-API budget. */
export class ExternalApiRateLimitError extends Error {
  constructor() {
    super("Too many external data requests. Please wait a moment and try again.");
    this.name = "ExternalApiRateLimitError";
  }
}

/**
 * Gate for the public `"use server"` statistics-API proxies. Each such action is a
 * directly-callable, unauthenticated endpoint, so every one must call this itself
 * (guarding the client-side caller is not enough — the action endpoint is reachable
 * on its own):
 *  - requires an authenticated session, closing the proxy to anonymous callers, and
 *  - enforces a per-user in-memory rate limit, bounding outbound amplification.
 *
 * Must run in a request-scoped context — not inside `"use cache"`, which forbids
 * `cookies()`. Throws on violation.
 */
export async function guardExternalApi(): Promise<void> {
  const session = await getSession(await cookies());
  if (!session.user?.isLoggedIn) {
    throw new ExternalApiAuthError();
  }
  if (!consumeToken(`external-api:${session.user.id}`, EXTERNAL_API_BUDGET)) {
    throw new ExternalApiRateLimitError();
  }
}
