import "server-only";
import { unstable_rethrow } from "next/navigation";

/**
 * Never cache failure-emptiness.
 *
 * A `'use cache'` function must let DB errors propagate: a rejected fill is not stored, so the
 * next request simply retries. Catching inside the cached function and returning null/[] instead
 * stores that "nothing found" as if it were real data until its tags are revalidated (staging
 * served empty pages after a reseed this way).
 *
 * So every fetcher is split in two: the cached `getCachedX()` only queries and throws on failure,
 * and the uncached public `getX()` wraps the call in this helper, which logs and returns the
 * fallback for the current request only. Next.js control-flow errors (notFound, redirect,
 * prerender bailouts) are rethrown untouched.
 */
export async function uncachedFallback<T>(
  fill: () => Promise<T>,
  fallback: NoInfer<T>,
  message: string,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fill();
  }
  catch (err) {
    unstable_rethrow(err);
    console.error(message, { ...context, err });
    return fallback;
  }
}

/** Default bound for one cached fill, see `boundedFill`. Override with `SAF_CACHE_FILL_TIMEOUT_MS`. */
const DEFAULT_FILL_TIMEOUT_MS = 20_000;

function fillTimeoutMs(): number {
  const value = Number(process.env.SAF_CACHE_FILL_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_FILL_TIMEOUT_MS;
}

export class CacheFillTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Cache fill "${label}" did not settle within ${ms} ms`);
    this.name = "CacheFillTimeoutError";
  }
}

/**
 * Bounds a cached fill: the body of a `'use cache'` DB reader runs inside this, and if it has not
 * settled after `SAF_CACHE_FILL_TIMEOUT_MS` (default 20 s) the fill rejects instead.
 *
 * Concurrent requests for the same cache key wait on one in-flight fill, so a hung fill (a stuck
 * connection, a starved pool) used to hold every one of them for Next's internal ~60 s (the prod
 * wedge). A rejected fill is not cached and each waiting uncached wrapper falls back for its own
 * request (`uncachedFallback`); the next request retries. Prisma queries cannot be aborted, so the
 * query itself runs on and its late result or error is dropped.
 */
export async function boundedFill<T>(label: string, fill: () => Promise<T>): Promise<T> {
  const ms = fillTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CacheFillTimeoutError(label, ms)), ms);
  });
  try {
    // race() subscribes to both, so a fill that rejects after the timeout is not an unhandled rejection
    return await Promise.race([fill(), timeout]);
  }
  finally {
    clearTimeout(timer);
  }
}
