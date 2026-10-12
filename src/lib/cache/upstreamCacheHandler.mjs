// @ts-check
/**
 * `'use cache: upstream'` handler: a disk-backed cache for external statistics (the curated
 * catalog's series and PxWeb metadata, the SCB population/area queries), so they survive a server
 * restart instead of re-hitting rate-limited upstreams. Registered in next.config.ts.
 *
 * Only for data that is neither user-specific nor derived from our DB: entries are shared by every
 * request and outlive DB reseeds.
 *
 * Plain JS (not TS) on purpose: Next imports this file at runtime with Node's own `import()`, and
 * traces it into the standalone output, so it must run without a bundler. Node built-ins only.
 *
 * Layout under `SAF_CACHE_DIR` (default `.next/cache/upstream` in the working directory):
 * - `entries/<sha256 of the cache key>.json`: the key, Next's entry metadata and the value bytes
 * - `tags.json`: when each tag was last revalidated, so `revalidateTag()` also holds across restarts
 *
 * Semantics follow Next's default in-memory handler (node_modules/next/dist/server/lib/cache-handlers/default.js):
 * an entry is gone once a tag it carries expired after it was written, and served with
 * `revalidate: -1` (stale, refreshed in the background) once a tag went stale after it was written.
 * Unlike the in-memory handler, an entry past its `revalidate` time is still returned until its
 * `expire` time: Next then serves it and refreshes it in the background, which is what a slow,
 * rate-limited upstream wants. Note that Next puts the build id into every cache key, so a new
 * deploy starts empty; expired files (old builds' included) are pruned at startup.
 *
 * @typedef {import("next/dist/server/lib/cache-handlers/types").CacheHandler} CacheHandler
 * @typedef {import("next/dist/server/lib/cache-handlers/types").CacheEntry} CacheEntry
 * @typedef {{ key: string, tags: string[], stale: number, timestamp: number, expire: number, revalidate: number, value: string }} StoredEntry
 * @typedef {{ stale?: number, expired?: number }} TagState
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const dir = path.resolve(process.env.SAF_CACHE_DIR || path.join(".next", "cache", "upstream"));
const entriesDir = path.join(dir, "entries");
const tagsFile = path.join(dir, "tags.json");

const debug = process.env.SAF_CACHE_DEBUG ? console.info.bind(console, "[upstream cache]") : undefined;

/** @type {Map<string, TagState>} */
const tags = new Map();
/** Sets still being written, so a `get` for the same key waits instead of missing (handler contract) */
/** @type {Map<string, Promise<void>>} */
const pendingSets = new Map();

let usable = true;
try {
  mkdirSync(entriesDir, { recursive: true });
  try {
    for (const [tag, state] of Object.entries(JSON.parse(readFileSync(tagsFile, "utf8")))) tags.set(tag, state);
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") console.warn("[upstream cache] ignoring unreadable tags file", tagsFile, err);
  }
  void prune();
} catch (err) {
  // An unwritable directory degrades to "no cache" rather than failing renders
  usable = false;
  console.error(`[upstream cache] disabled, cannot use ${dir}`, err);
}

const now = () => performance.timeOrigin + performance.now();

/** @param {string} cacheKey */
function fileFor(cacheKey) {
  return path.join(entriesDir, `${createHash("sha256").update(cacheKey).digest("hex")}.json`);
}

/** Write-then-rename, so a crash or a concurrent read never sees half a file */
async function writeAtomic(/** @type {string} */ file, /** @type {string} */ content) {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await writeFile(tmp, content);
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }
}

/** Removes entries past their expire time, from any build (Next keys include the build id) */
async function prune() {
  let removed = 0;
  for (const name of await readdir(entriesDir)) {
    const file = path.join(entriesDir, name);
    try {
      if (name.endsWith(".tmp")) {
        await rm(file, { force: true });
        continue;
      }
      /** @type {StoredEntry} */
      const stored = JSON.parse(await readFile(file, "utf8"));
      if (now() > stored.timestamp + stored.expire * 1000) {
        await rm(file, { force: true });
        removed++;
      }
    } catch {
      await rm(file, { force: true });
    }
  }
  debug?.("pruned", removed);
}

/** @param {string[]} entryTags @param {number} timestamp */
function tagsExpired(entryTags, timestamp) {
  const current = now();
  return entryTags.some(tag => {
    const expired = tags.get(tag)?.expired;
    return typeof expired === "number" && expired <= current && expired > timestamp;
  });
}

/** @param {string[]} entryTags @param {number} timestamp */
function tagsStale(entryTags, timestamp) {
  return entryTags.some(tag => (tags.get(tag)?.stale ?? 0) > timestamp);
}

/** @type {CacheHandler} */
const handler = {
  async get(cacheKey, softTags) {
    if (!usable) return undefined;
    try {
      await pendingSets.get(cacheKey);

      /** @type {StoredEntry} */
      let stored;
      try {
        stored = JSON.parse(await readFile(fileFor(cacheKey), "utf8"));
      } catch (err) {
        if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") debug?.("unreadable entry", err);
        return undefined;
      }
      if (stored.key !== cacheKey) return undefined; // hash collision
      if (stored.expire < 0 || now() > stored.timestamp + stored.expire * 1000) return undefined;
      // Soft tags (revalidatePath) are checked here too; getExpiration answers for them as well
      if (tagsExpired(stored.tags, stored.timestamp) || tagsExpired(softTags, stored.timestamp)) {
        debug?.("get", "expired tag");
        return undefined;
      }

      const bytes = Buffer.from(stored.value, "base64");
      debug?.("get", "hit", bytes.byteLength);
      return {
        value: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(bytes));
            controller.close();
          },
        }),
        tags: stored.tags,
        stale: stored.stale,
        timestamp: stored.timestamp,
        expire: stored.expire,
        revalidate: tagsStale(stored.tags, stored.timestamp) || tagsStale(softTags, stored.timestamp) ? -1 : stored.revalidate,
      };
    } catch (err) {
      // Next does not catch errors from get(); a broken cache must read as a miss
      console.error("[upstream cache] get failed", err);
      return undefined;
    }
  },

  async set(cacheKey, pendingEntry) {
    /** @type {() => void} */
    let resolvePending = () => {};
    pendingSets.set(cacheKey, new Promise(resolve => { resolvePending = resolve; }));
    try {
      const entry = await pendingEntry;
      // Read the whole value first: a stream that errors midway is discarded, never stored partially
      // (the render error itself is reported by Next)
      const chunks = [];
      try {
        const reader = entry.value.getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) chunks.push(chunk.value);
      } catch (err) {
        debug?.("set", "value stream failed", err);
        return;
      }
      if (!usable) return;
      // Dynamic entries are regenerated on every read in production anyway (same as the default handler)
      if (!process.env.__NEXT_DEV_SERVER && entry.expire === 0) return;

      /** @type {StoredEntry} */
      const stored = {
        key: cacheKey,
        tags: entry.tags,
        stale: entry.stale,
        timestamp: entry.timestamp,
        expire: entry.expire,
        revalidate: entry.revalidate,
        value: Buffer.concat(chunks).toString("base64"),
      };
      await writeAtomic(fileFor(cacheKey), JSON.stringify(stored));
      debug?.("set", entry.tags, stored.value.length);
    } catch (err) {
      console.error("[upstream cache] set failed", err);
    } finally {
      resolvePending();
      pendingSets.delete(cacheKey);
    }
  },

  async refreshTags() {
    // Single process: the in-memory tag state is authoritative
  },

  async getExpiration(softTags) {
    return Math.max(0, ...softTags.map(tag => tags.get(tag)?.expired ?? 0));
  },

  async updateTags(updatedTags, durations) {
    const current = Math.round(now());
    for (const tag of updatedTags) {
      const state = { ...tags.get(tag) };
      if (durations) {
        state.stale = current;
        if (durations.expire !== undefined) state.expired = current + durations.expire * 1000;
      } else {
        state.expired = current;
      }
      tags.set(tag, state);
    }
    if (!usable) return;
    try {
      await writeAtomic(tagsFile, JSON.stringify(Object.fromEntries(tags)));
    } catch (err) {
      console.error("[upstream cache] could not persist tags", err);
    }
  },
};

export default handler;
