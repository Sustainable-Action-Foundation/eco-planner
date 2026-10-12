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
