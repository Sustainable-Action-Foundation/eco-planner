import { expect, test } from "playwright/test";

import { consumeToken } from "../../src/lib/rateLimit";

/*
 * Token bucket with lazy refill. The clock is injected as the third argument;
 * buckets live in a module-level map, so every test uses its own keys.
 */

const budget = { capacity: 3, refillPerSecond: 1 };
let counter = 0;
const key = () => `test-${test.info().workerIndex}-${counter++}`;

test.describe("consumeToken", () => {
  test("a fresh bucket allows a burst of `capacity` calls, then denies", () => {
    const k = key();
    for (let i = 0; i < budget.capacity; i++) {
      expect(consumeToken(k, budget, 1_000), `call ${i}`).toBe(true);
    }
    expect(consumeToken(k, budget, 1_000)).toBe(false);
    expect(consumeToken(k, budget, 1_000)).toBe(false);
  });

  test("tokens refill at refillPerSecond and a partial token is not enough", () => {
    const k = key();
    for (let i = 0; i < budget.capacity; i++) consumeToken(k, budget, 0);
    expect(consumeToken(k, budget, 0)).toBe(false);
    // Half a second later: 0.5 tokens
    expect(consumeToken(k, budget, 500)).toBe(false);
    // One second after the drain: a full token
    expect(consumeToken(k, budget, 1_000)).toBe(true);
    expect(consumeToken(k, budget, 1_000)).toBe(false);
    // Fractions accumulate across denied calls
    expect(consumeToken(k, budget, 1_400)).toBe(false);
    expect(consumeToken(k, budget, 2_000)).toBe(true);
  });

  test("refill never exceeds the capacity", () => {
    const k = key();
    expect(consumeToken(k, budget, 0)).toBe(true);
    // An hour of idling refills to capacity, not beyond
    for (let i = 0; i < budget.capacity; i++) {
      expect(consumeToken(k, budget, 3_600_000), `call ${i}`).toBe(true);
    }
    expect(consumeToken(k, budget, 3_600_000)).toBe(false);
  });

  test("a higher refill rate sustains a proportionally higher pace", () => {
    const k = key();
    const fast = { capacity: 1, refillPerSecond: 10 };
    expect(consumeToken(k, fast, 0)).toBe(true);
    expect(consumeToken(k, fast, 50)).toBe(false);
    expect(consumeToken(k, fast, 100)).toBe(true);
    expect(consumeToken(k, fast, 200)).toBe(true);
    expect(consumeToken(k, fast, 250)).toBe(false);
  });

  test("buckets are isolated per key", () => {
    const a = key();
    const b = key();
    for (let i = 0; i < budget.capacity; i++) consumeToken(a, budget, 0);
    expect(consumeToken(a, budget, 0)).toBe(false);
    expect(consumeToken(b, budget, 0)).toBe(true);
    // Draining b does not top a back up
    for (let i = 0; i < budget.capacity; i++) consumeToken(b, budget, 0);
    expect(consumeToken(a, budget, 0)).toBe(false);
    expect(consumeToken(b, budget, 0)).toBe(false);
  });

  test("the clock defaults to now, so a brand-new key is allowed", () => {
    expect(consumeToken(key(), budget)).toBe(true);
  });
});
