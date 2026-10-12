/**
 * Process-global Prisma query counters (always on, cheap) plus an opt-in per-burst console
 * summary when `SAF_DB_TRACE=true` (dev-only intent; it logs SQL).
 *
 * State lives on globalThis so it survives dev HMR module reloads and is shared by every
 * module instance in the process. Nothing here may throw into Prisma's query path.
 */

export type DbQueryEvent = {
  query: string;
  duration: number;
  timestamp: Date;
};

export type DbStats = {
  /** Total SQL statements executed since process start */
  queries: number;
  /** Sum of statement durations in ms */
  dbMs: number;
  /** Per-table histogram, keyed by `<verb> <table>` parsed from the SQL */
  byTarget: Record<string, { count: number; ms: number }>;
};

type TraceStatement = { target: string; sql: string; ms: number };
type TraceState = { statements: TraceStatement[]; start: number; timer: ReturnType<typeof setTimeout> | null };

const TRACE_QUIET_MS = 250;

const globalForDbStats = globalThis as unknown as {
  safDbStats?: DbStats;
  safDbTrace?: TraceState;
};

function stats(): DbStats {
  globalForDbStats.safDbStats ??= { queries: 0, dbMs: 0, byTarget: {} };
  return globalForDbStats.safDbStats;
}

/** Same parsing rules as `boolEnv` in tests/lib/env.ts, but never throws */
export function dbTraceEnabled(): boolean {
  const value = process.env.SAF_DB_TRACE?.toLowerCase();
  return value === "true" || value === "1";
}

/** `SELECT Goals`, `INSERT DateRecords`, ... Falls back to the first word of the statement. */
export function queryTarget(sql: string): string {
  const verb = (/^\s*(\w+)/.exec(sql)?.[1] ?? "?").toUpperCase();
  const table = /\b(?:FROM|INTO|UPDATE)\s+(?:`[^`]+`\.)?`([^`]+)`/i.exec(sql)?.[1];
  return table ? `${verb} ${table}` : verb;
}

export function recordQuery(event: DbQueryEvent) {
  try {
    // Driver-adapter bookkeeping pseudo-statements ("-- Implicit COMMIT ...") are not round trips
    if (event.query.trimStart().startsWith("--")) return;

    const ms = Number.isFinite(event.duration) ? event.duration : 0;
    const target = queryTarget(event.query);

    const s = stats();
    s.queries++;
    s.dbMs += ms;
    s.byTarget[target] ??= { count: 0, ms: 0 };
    s.byTarget[target].count++;
    s.byTarget[target].ms += ms;

    if (dbTraceEnabled()) trace({ target, sql: event.query, ms }, event.timestamp);
  }
  catch {
    // Instrumentation must never affect queries
  }
}

export function getDbStats(): DbStats {
  const s = stats();
  return { queries: s.queries, dbMs: Math.round(s.dbMs * 100) / 100, byTarget: { ...s.byTarget } };
}

function trace(statement: TraceStatement, timestamp: Date) {
  globalForDbStats.safDbTrace ??= { statements: [], start: 0, timer: null };
  const state = globalForDbStats.safDbTrace;
  if (state.statements.length === 0) state.start = timestamp.getTime();
  state.statements.push(statement);

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(flushTrace, TRACE_QUIET_MS);
  // Don't keep the process alive for a pending summary
  state.timer.unref?.();
}

function flushTrace() {
  const state = globalForDbStats.safDbTrace;
  if (!state || state.statements.length === 0) return;

  const statements = state.statements;
  const spanMs = Date.now() - TRACE_QUIET_MS - state.start;
  state.statements = [];
  state.timer = null;

  const dbMs = statements.reduce((sum, s) => sum + s.ms, 0);
  const counts = new Map<string, number>();
  for (const s of statements) counts.set(s.target, (counts.get(s.target) ?? 0) + 1);

  const slowest = [...statements].sort((a, b) => b.ms - a.ms).slice(0, 3);
  const lines = [
    `[db] ${statements.length} queries, ${dbMs.toFixed(1)} ms db-time over ${Math.max(0, spanMs)} ms span, slowest: ${slowest[0]?.target} ${slowest[0]?.ms.toFixed(1)} ms`,
    ...slowest.map((s) => `[db]   ${s.ms.toFixed(1).padStart(7)} ms  ${s.sql.replace(/\s+/g, " ").slice(0, 120)}`),
    `[db]   by target: ${[...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(", ")}`,
  ];
  console.info(lines.join("\n"));
}
