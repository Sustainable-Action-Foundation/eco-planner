import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * A cross-process mutex for the few tests that must mutate one shared seeded
 * entity (e.g. renaming a seeded org): the browser projects run the same spec
 * in parallel workers, and a worker is a separate process, so the lock lives
 * on disk (an atomic mkdir). A lock older than `staleMs` is treated as left
 * behind by a crashed worker and taken over.
 */
export async function withLock<T>(name: string, fn: () => Promise<T>, { staleMs = 180_000, timeoutMs = 300_000 } = {}): Promise<T> {
  const dir = path.join(tmpdir(), `eco-planner-e2e-lock-${name}`);
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(dir);
      break;
    }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        if (Date.now() - statSync(dir).mtimeMs > staleMs) {
          rmSync(dir, { recursive: true, force: true });
          continue;
        }
      }
      catch {
        // Released between our checks; try again
        continue;
      }
      if (Date.now() - started > timeoutMs) throw new Error(`Lock "${name}" was not released within ${timeoutMs} ms`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  try {
    return await fn();
  }
  finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
