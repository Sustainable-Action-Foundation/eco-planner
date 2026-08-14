import "server-only";

type Bucket = { tokens: number; last: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Maximum burst size / bucket capacity, in tokens. */
  capacity: number;
  /** Tokens refilled per second. Sustained rate ≈ refillPerSecond * 60 per minute. */
  refillPerSecond: number;
};

/**
 * Minimal in-memory token-bucket rate limiter.
 *
 * This is valid because production runs a single app instance (see
 * docker/compose.prod.yaml). If the app is ever scaled horizontally, back this with a
 * shared store (e.g. Redis) so limits hold across instances.
 *
 * @returns true if a token was available and consumed (allow the call), false if the
 *          caller is over budget (deny).
 */
export function consumeToken(key: string, { capacity, refillPerSecond }: RateLimitOptions): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, last: now };

  // Refill lazily based on time elapsed since the bucket was last touched.
  const refill = ((now - bucket.last) / 1000) * refillPerSecond;
  bucket.tokens = Math.min(capacity, bucket.tokens + refill);
  bucket.last = now;

  const allowed = bucket.tokens >= 1;
  if (allowed) bucket.tokens -= 1;
  buckets.set(key, bucket);

  // Bound memory: once the map grows large, drop buckets that have fully refilled
  // (i.e. keys that have been idle long enough to be indistinguishable from new ones).
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (b.tokens >= capacity) buckets.delete(k);
    }
  }

  return allowed;
}
