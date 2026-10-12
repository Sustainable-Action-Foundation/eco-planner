import { expect, test } from "playwright/test";
import type { CacheEntry, CacheHandler } from "next/dist/server/lib/cache-handlers/types";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/*
 * The disk-backed `'use cache: upstream'` handler: entries and tag revalidations must survive a
 * new handler instance (a server restart), and tag semantics must match Next's default handler.
 */

const handlerFile = path.join(process.cwd(), "src/lib/cache/upstreamCacheHandler.mjs");
let instance = 0;

/** A fresh module instance over `dir`, as a restarted server would load it */
async function loadHandler(dir: string): Promise<CacheHandler> {
  process.env.SAF_CACHE_DIR = dir;
  const mod = await import(`${pathToFileURL(handlerFile).href}?instance=${instance++}`) as { default: CacheHandler };
  return mod.default;
}

function entry(text: string, overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    value: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    tags: ["curatedHistoricalData"],
    stale: 300,
    timestamp: Date.now(),
    revalidate: 86_400,
    expire: 604_800,
    ...overrides,
  };
}

/** Tag revalidation timestamps are rounded to whole ms, so a get in the same half-millisecond may still see the entry */
const settle = () => new Promise(resolve => setTimeout(resolve, 2));

async function read(found: CacheEntry | undefined): Promise<string | undefined> {
  return found ? await new Response(found.value).text() : undefined;
}

test.describe("upstream cache handler", () => {
  let dir: string;
  test.beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "upstream-cache-"));
  });
  test.afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("entries survive a restart", async () => {
    const first = await loadHandler(dir);
    await first.set("key-a", Promise.resolve(entry("hello")));
    expect(await read(await first.get("key-a", []))).toBe("hello");
    // Readable more than once
    expect(await read(await first.get("key-a", []))).toBe("hello");

    const restarted = await loadHandler(dir);
    const found = await restarted.get("key-a", []);
    expect(await read(found)).toBe("hello");
    expect(found?.tags).toEqual(["curatedHistoricalData"]);
    expect(await restarted.get("key-b", [])).toBeUndefined();
  });

  test("a get waits for a pending set of the same key", async () => {
    const handler = await loadHandler(dir);
    const { promise, resolve } = Promise.withResolvers<CacheEntry>();
    const setting = handler.set("key-a", promise);
    const getting = handler.get("key-a", []);
    resolve(entry("late"));
    await setting;
    expect(await read(await getting)).toBe("late");
  });

  test("expired tags drop entries, also after a restart", async () => {
    const handler = await loadHandler(dir);
    await handler.set("key-a", Promise.resolve(entry("old", { timestamp: Date.now() - 1000 })));
    await handler.updateTags(["curatedHistoricalData"], { expire: 0 });
    await settle();
    expect(await handler.get("key-a", [])).toBeUndefined();

    const restarted = await loadHandler(dir);
    expect(await restarted.get("key-a", [])).toBeUndefined();
    // Entries written after the revalidation are served
    await restarted.set("key-a", Promise.resolve(entry("new", { timestamp: Date.now() + 5 })));
    expect(await read(await restarted.get("key-a", []))).toBe("new");
  });

  test("stale tags serve the entry marked for background revalidation", async () => {
    const handler = await loadHandler(dir);
    await handler.set("key-a", Promise.resolve(entry("old", { timestamp: Date.now() - 1000 })));
    await handler.updateTags(["curatedHistoricalData"], {});
    const found = await handler.get("key-a", []);
    expect(await read(found)).toBe("old");
    expect(found?.revalidate).toBe(-1);
  });

  test("other tags and soft tags", async () => {
    const handler = await loadHandler(dir);
    await handler.set("key-a", Promise.resolve(entry("kept", { timestamp: Date.now() - 1000 })));
    await handler.updateTags(["goal"], { expire: 0 });
    expect(await read(await handler.get("key-a", []))).toBe("kept");

    await handler.updateTags(["_N_T_/"], { expire: 0 });
    await settle();
    expect(await handler.getExpiration(["_N_T_/"])).toBeGreaterThan(0);
    expect(await handler.getExpiration(["_N_T_/other"])).toBe(0);
    expect(await handler.get("key-a", ["_N_T_/"])).toBeUndefined();
  });

  test("entries past expire are gone and pruned at startup", async () => {
    const handler = await loadHandler(dir);
    await handler.set("key-a", Promise.resolve(entry("old", { timestamp: Date.now() - 10_000, expire: 1 })));
    await handler.set("key-b", Promise.resolve(entry("fresh")));
    expect(await handler.get("key-a", [])).toBeUndefined();
    // Past revalidate but within expire: still returned, Next refreshes it in the background
    await handler.set("key-c", Promise.resolve(entry("stale", { timestamp: Date.now() - 10_000, revalidate: 1 })));
    expect(await read(await handler.get("key-c", []))).toBe("stale");

    await loadHandler(dir);
    await expect.poll(async () => (await readdir(path.join(dir, "entries"))).length).toBe(2);
  });

  test("a stream that errors is not stored", async () => {
    const handler = await loadHandler(dir);
    const broken: CacheEntry = {
      ...entry(""),
      value: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("partial"));
          controller.error(new Error("render failed"));
        },
      }),
    };
    await handler.set("key-a", Promise.resolve(broken));
    expect(await handler.get("key-a", [])).toBeUndefined();
  });
});
