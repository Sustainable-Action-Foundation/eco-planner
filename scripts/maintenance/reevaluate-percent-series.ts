/**
 * Re-evaluates stored data series whose recipe produced percent values, and
 * rewrites the ones that came out 100x too small.
 *
 * Until 2026-11-02 the mathjs instance in `@/math` collapsed the dimensionless
 * `procent` unit to a bare number in multiply/divide, and the evaluator relabelled
 * the SI value as procent: a copy of a 91.68 procent national series was stored as
 * 0.9168 "procent". The evaluator is fixed (`predictable: true` + convertToDeclaredUnit,
 * see tests/unit/recipe-percent.test.ts); this script repairs the data.
 *
 * Every derived (non-manual) series whose stored unit is procent is re-evaluated
 * with the current evaluator, the way `/api/recalculate` does it, and the new
 * values are compared year by year with the stored ones:
 *   unchanged  every ratio new/old within 1e-9 of 1
 *   x100       every ratio within 1% of 100 (x100^2, x100^3 for a copy of a copy, same bug compounded)
 *   other      anything else: mixed ratios, different year sets, zeros on one side
 *   error      the recipe could not be evaluated (listed, never touched)
 * Series are processed in dependency order (sources before the series reading
 * them), with the corrected values of an x100 series feeding its dependents, so
 * one pass is a fixpoint.
 *
 * A goal's derived baseline ("initial value", `meta.baselineDerivation`) inlines a
 * snapshot of the goal's series instead of linking it, so re-evaluating its stored
 * recipe only echoes the snapshot. Those are re-derived from the goal's (corrected)
 * series the way the goal form does on save, and `--apply` rewrites their recipe
 * (the inline snapshot) along with the values. Manual series are never touched.
 *
 * Usage (dry run writes nothing; reads DATABASE_URL from .env):
 *   node_modules/.bin/tsx scripts/maintenance/reevaluate-percent-series.ts
 *   node_modules/.bin/tsx scripts/maintenance/reevaluate-percent-series.ts --apply
 *   --all-units        every derived series, not only percent ones (sanity check: the rest must be unchanged)
 *   --series <id>...   only these series ids (any unit)
 *   --quiet            only the summary and the non-unchanged lines
 *
 * `--apply` rewrites the DateRecords of every x100 series (one nested update, i.e.
 * one transaction, per series) and bumps its updated_at. It refuses to run unless
 * DATABASE_URL points at localhost or REEVAL_I_HAVE_A_BACKUP=1 is set.
 *
 * After a run on a server, restart the app container: the `use cache` readers
 * (tags database/dataSeries/goal/...) keep serving the old values until then.
 */
import "dotenv/config";
// Standalone script: its own client (no next-only imports, no query-event logging), as @/lib/prisma builds it
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "../../prisma/generated/client";
import { makeMariaDBAdapter } from "@/lib/prisma/mariadb-adapter";
import { Recipe } from "@/functions/recipe/recipe";
import { dateValuesToDBDateRecord, isMathjsUnit, isoYearDate } from "@/functions/recipe/vectorAndMaskUtils";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import { BaselineType } from "@/types/enums";
import { clientSafeDataSeriesSelection } from "@/fetchers/inclusionSelectors";
import { isUnitFlag, parseUnit } from "@/functions/unit";
import mathjs from "@/math";
import type { DataSeries, DateValues } from "@/types";

const Classification = {
  Unchanged: "unchanged",
  /** Every ratio new/old is a power of 100 (`power` says which; 2+ is a copy of a copy) */
  Hundredfold: "x100",
  Other: "other",
  Error: "error",
} as const;
type Classification = (typeof Classification)[keyof typeof Classification];

type Verdict = { classification: Classification; power?: number; detail: string };

/** The class as printed: `x100`, `x100^2`... */
function label(verdict: Pick<Verdict, "classification" | "power">): string {
  return verdict.classification === Classification.Hundredfold && (verdict.power ?? 1) > 1
    ? `${Classification.Hundredfold}^${verdict.power}`
    : verdict.classification;
}

type Candidate = {
  id: string;
  unit: string | null;
  recipe: Recipe;
  sourceIds: string[];
  context: string;
  goalId: string | null;
  /** Set for a derived baseline: re-derive from this (the goal's) series instead of evaluating the inline snapshot */
  derivedFromSeriesId?: string;
};

type Result = Verdict & {
  candidate: Candidate;
  records: ReturnType<typeof dateValuesToDBDateRecord>;
  /** The rebuilt recipe of a re-derived baseline, stored alongside the values */
  recipeToStore?: string;
};

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allUnits = args.includes("--all-units");
const quiet = args.includes("--quiet");
const seriesArgIndex = args.indexOf("--series");
const onlySeries = seriesArgIndex === -1
  ? null
  : args.slice(seriesArgIndex + 1).filter(arg => !arg.startsWith("--"));

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not defined");
const dbHost = new URL(DATABASE_URL).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost);
if (apply && !isLocal && process.env.REEVAL_I_HAVE_A_BACKUP !== "1") {
  console.error(`Refusing --apply against ${dbHost}: take a fresh backup first, then set REEVAL_I_HAVE_A_BACKUP=1.`);
  process.exit(2);
}

// Own client: no dbStats query logging, no proxy, no next-only imports
const prisma = new PrismaClient(makeMariaDBAdapter(DATABASE_URL));

const procent = mathjs.unit(1, "procent");
/** Whether a stored unit is a percent (procent/percent), whatever its spelling. */
function isPercentUnit(raw: string | null): boolean {
  const unit = parseUnit(raw);
  if (isUnitFlag(unit) || !isMathjsUnit(unit)) return false;
  const parsed = mathjs.unit(1, unit);
  return parsed.equalBase(procent) && Math.abs(parsed.toNumber("procent") - 1) < 1e-12;
}

function yearOf(timestamp: Date): number {
  return new Date(timestamp).getUTCFullYear();
}

/** Stored values by year; the overlay holds the corrected values of x100 series already processed. */
const seriesCache = new Map<string, DataSeries | null>();
async function getDataSeries(id: string): Promise<DataSeries | null> {
  const cached = seriesCache.get(id);
  if (cached !== undefined) return cached;
  const series = await prisma.dataSeries.findUnique({ where: { id }, select: clientSafeDataSeriesSelection });
  seriesCache.set(id, series);
  return series;
}

function sourceIdsOf(recipe: Recipe): string[] {
  return recipe.variables.flatMap(variable => {
    if (variable.type === RecipeDataTypes.DataSeries || variable.type === RecipeDataTypes.External) {
      return variable.dataSeriesId ? [variable.dataSeriesId] : [];
    }
    return [];
  });
}

/** Sources before dependents (Kahn); a cycle, should one exist, is appended in input order with a warning. */
function topologicalOrder(candidates: Candidate[]): Candidate[] {
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const remaining = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const candidate of candidates) {
    const internal = candidate.sourceIds.filter(id => byId.has(id) && id !== candidate.id);
    remaining.set(candidate.id, internal.length);
    for (const sourceId of internal) dependents.set(sourceId, [...(dependents.get(sourceId) ?? []), candidate.id]);
  }
  const ordered: Candidate[] = [];
  const queue = candidates.filter(candidate => remaining.get(candidate.id) === 0);
  for (let next = queue.shift(); next; next = queue.shift()) {
    ordered.push(next);
    for (const dependentId of dependents.get(next.id) ?? []) {
      const left = (remaining.get(dependentId) ?? 1) - 1;
      remaining.set(dependentId, left);
      const dependent = byId.get(dependentId);
      if (left === 0 && dependent) queue.push(dependent);
    }
  }
  if (ordered.length < candidates.length) {
    const inCycle = candidates.filter(candidate => !ordered.includes(candidate));
    console.warn(`Warning: ${inCycle.length} series form a dependency cycle; processing them last in input order.`);
    ordered.push(...inCycle);
  }
  return ordered;
}

function classify(stored: Map<number, number>, fresh: Map<number, number>): Verdict {
  const storedYears = [...stored.keys()].sort();
  const freshYears = [...fresh.keys()].sort();
  if (storedYears.join() !== freshYears.join()) {
    const missing = storedYears.filter(year => !fresh.has(year));
    const added = freshYears.filter(year => !stored.has(year));
    return { classification: Classification.Other, detail: `year set differs (lost ${missing.join(",") || "-"}, gained ${added.join(",") || "-"})` };
  }
  const ratios: number[] = [];
  for (const year of storedYears) {
    const oldValue = stored.get(year) ?? NaN;
    const newValue = fresh.get(year) ?? NaN;
    if (oldValue === 0 && newValue === 0) continue;
    if (oldValue === 0 || newValue === 0) return { classification: Classification.Other, detail: `${year}: ${oldValue} -> ${newValue}` };
    ratios.push(newValue / oldValue);
  }
  if (ratios.every(ratio => Math.abs(ratio - 1) < 1e-9)) return { classification: Classification.Unchanged, detail: "" };
  for (let power = 1; power <= 4; power++) {
    const factor = 100 ** power;
    if (ratios.every(ratio => Math.abs(ratio / factor - 1) < 0.01)) {
      return { classification: Classification.Hundredfold, power, detail: `ratio ~${factor}` };
    }
  }
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  return { classification: Classification.Other, detail: `ratios ${min.toPrecision(4)}..${max.toPrecision(4)}` };
}

function sample(values: Map<number, number>): string {
  if (values.size === 0) return "-";
  const years = [...values.keys()].sort();
  const year = values.has(2050) ? 2050 : years[years.length - 1];
  return `${year}=${(values.get(year) ?? NaN).toPrecision(6)}`;
}

async function loadCandidates(): Promise<Candidate[]> {
  const goalContext = { select: { id: true, data_series_id: true, roadmap_iteration: { select: { version: true, roadmap: { select: { name: true } } } } } } as const;
  const rows = await prisma.dataSeries.findMany({
    where: onlySeries ? { id: { in: onlySeries } } : {},
    select: {
      id: true,
      unit: true,
      org: { select: { name: true } },
      recipe_used: { select: { recipe: true } },
      dependent_goal: goalContext,
      dependent_baseline: goalContext,
      dependent_historical: goalContext,
      dependent_effect: { select: { goal: goalContext, action: { select: { name: true } } } },
    },
  });

  const candidates: Candidate[] = [];
  let manual = 0;
  let unparsable = 0;
  let derivedBaselines = 0;
  for (const row of rows) {
    if (!onlySeries && !allUnits && !isPercentUnit(row.unit)) continue;
    let recipe: Recipe;
    try {
      recipe = Recipe.from(row.recipe_used.recipe);
    }
    catch (err) {
      unparsable++;
      console.warn(`Skipping ${row.id}: recipe does not parse (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    // A hand-entered series must never be rewritten (its inline recipe only echoes the typed values)
    if (recipe.isManual()) { manual++; continue; }

    const slot = row.dependent_goal ? ["goal", row.dependent_goal] as const
      : row.dependent_baseline ? ["baseline", row.dependent_baseline] as const
        : row.dependent_historical ? ["historical", row.dependent_historical] as const
          : row.dependent_effect ? ["effect", row.dependent_effect.goal] as const
            : ["orphan", null] as const;
    const goal = slot[1];
    const iteration = goal?.roadmap_iteration;
    const context = [
      `goal=${goal?.id ?? "-"}`,
      `roadmap="${iteration ? `${iteration.roadmap.name} v${iteration.version}` : "-"}"`,
      `org="${row.org.name}"`,
      `slot=${slot[0]}${slot[0] === "effect" ? `(${row.dependent_effect?.action.name})` : ""}`,
    ].join(" ");

    // A derived baseline follows the goal's series, which must be processed first
    const derivation = recipe.baselineDerivation();
    const derivedFromSeriesId = (derivation === BaselineType.Initial || derivation === BaselineType.InitialNonZero) && slot[0] === "baseline"
      ? row.dependent_baseline?.data_series_id ?? undefined
      : undefined;
    if (derivedFromSeriesId) derivedBaselines++;

    candidates.push({
      id: row.id,
      unit: row.unit,
      recipe,
      sourceIds: [...sourceIdsOf(recipe), ...(derivedFromSeriesId ? [derivedFromSeriesId] : [])],
      context,
      goalId: goal?.id ?? null,
      derivedFromSeriesId,
    });
  }
  console.info(`${rows.length} series read, ${candidates.length} candidates of which ${derivedBaselines} derived baselines (${manual} manual skipped, ${unparsable} unparsable recipes skipped)${allUnits ? ", all units" : onlySeries ? ", explicit ids" : ", percent units only"}`);
  return candidates;
}

async function evaluateCandidate(candidate: Candidate): Promise<Result> {
  const stored = await getDataSeries(candidate.id);
  const storedValues = new Map((stored?.values ?? []).map(record => [yearOf(record.timestamp), record.value]));
  try {
    const warnings: string[] = [];
    let recipe = candidate.recipe;
    let recipeToStore: string | undefined;
    if (candidate.derivedFromSeriesId) {
      const goalSeries = await getDataSeries(candidate.derivedFromSeriesId);
      if (!goalSeries) throw new Error(`goal series ${candidate.derivedFromSeriesId} not found`);
      const dateValues: DateValues = Object.fromEntries(goalSeries.values.map(record => [isoYearDate(yearOf(record.timestamp)), record.value]));
      // As the goal form rebuilds it on save (goalSections.ts), keeping the inline variable id
      recipe = Recipe.fromInitialDateValue(
        { unit: recipe.unit, dateValues },
        { nonZero: recipe.baselineDerivation() === BaselineType.InitialNonZero },
        recipe.variables[0]?.id,
      );
      recipeToStore = recipe.serialize();
    }
    const evaluation = await recipe.evaluate(warnings, { dataSeriesGetter: getDataSeries });
    if (!evaluation) throw new Error("evaluation returned nothing");
    const records = dateValuesToDBDateRecord(evaluation.dateValues);
    const freshValues = new Map(records.map(record => [yearOf(record.timestamp), record.value]));
    const { classification, power, detail } = classify(storedValues, freshValues);
    const unitNote = evaluation.unit !== parseUnit(candidate.unit) ? ` (evaluated unit ${String(evaluation.unit)} != stored ${String(candidate.unit)}, unit left as is)` : "";
    return {
      candidate,
      classification,
      power,
      detail: `stored ${sample(storedValues)} new ${sample(freshValues)}${detail ? ` ${detail}` : ""}${candidate.derivedFromSeriesId ? " (re-derived baseline)" : ""}${unitNote}`,
      records,
      recipeToStore,
    };
  }
  catch (err) {
    return {
      candidate,
      classification: Classification.Error,
      detail: `stored ${sample(storedValues)}: ${err instanceof Error ? err.message : String(err)}`,
      records: [],
    };
  }
}

function isCorrectable(classification: Classification): boolean {
  return classification === Classification.Hundredfold;
}

async function main() {
  console.info(`${apply ? "APPLY" : "Dry run"} against ${dbHost}`);
  const candidates = topologicalOrder(await loadCandidates());

  const results: Result[] = [];
  let seriesTouched = 0;
  let recordsWritten = 0;
  let recipesRewritten = 0;
  for (const candidate of candidates) {
    const result = await evaluateCandidate(candidate);
    results.push(result);
    const line = `${label(result).padEnd(9)} ${candidate.id} ${candidate.context} unit="${candidate.unit}" ${result.detail}`;
    if (!quiet || result.classification !== Classification.Unchanged) console.info(line);

    if (!isCorrectable(result.classification)) continue;

    // Dependents read the corrected values (from here on in the dry run; from the db after apply)
    seriesCache.set(candidate.id, {
      id: candidate.id,
      unit: candidate.unit,
      values: result.records.map(record => ({ data_series_id: candidate.id, timestamp: record.timestamp, value: record.value })),
    });

    if (apply) {
      // Same nested write as /api/recalculate: one statement batch, one transaction per series
      await prisma.dataSeries.update({
        where: { id: candidate.id },
        data: {
          values: { deleteMany: {}, createMany: { data: result.records } },
          updated_at: new Date(),
          // A re-derived baseline also gets its rebuilt inline snapshot, serialized as the app stores recipes
          ...(result.recipeToStore ? { recipe_used: { update: { recipe: result.recipeToStore } } } : {}),
        },
      });
      seriesTouched++;
      recordsWritten += result.records.length;
      if (result.recipeToStore) recipesRewritten++;
    }
  }

  const counts = new Map<string, number>();
  for (const result of results) counts.set(label(result), (counts.get(label(result)) ?? 0) + 1);
  console.info("\nSummary:");
  for (const [classification, count] of [...counts.entries()].sort()) console.info(`  ${classification.padEnd(9)} ${count}`);
  const forReview = results.filter(result => result.classification === Classification.Other || result.classification === Classification.Error);
  if (forReview.length > 0) console.info(`  ${forReview.length} series left for review (other/error), see the lines above`);

  if (apply) {
    console.info(`\nWritten: ${seriesTouched} series, ${recordsWritten} date records, ${recipesRewritten} baseline recipes.`);
    console.info("Cached readers still hold the old values: restart the app container (or revalidate the 'dataSeries' tag, as /api/recalculate does with revalidateTag('dataSeries', { expire: 0 }); the readers are also tagged database/goal/roadmap/roadmapIteration/action).");
  }
  else {
    const correctable = results.filter(result => isCorrectable(result.classification)).length;
    console.info(`\nDry run: nothing written. --apply would rewrite ${correctable} series.`);
  }
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
