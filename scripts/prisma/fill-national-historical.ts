/**
 * Gives the goals of the national scenarios (roadmaps of type NATIONAL, the seeded LEAP
 * scenarios) historical data from the national statistic that measures their LEAP row
 * (`getLeapNationalSource`). Goals that already have historical data are left alone, so
 * re-running is safe; goals whose row has no direct match are reported and skipped.
 *
 * What is stored per goal mirrors what the goal form stores for an external historical
 * source (see scripts/lib/nationalHistorical.ts), so the goal page shows the source and
 * the series can be re-fetched or edited later.
 *
 * Usage (reads DATABASE_URL; the react-server condition turns the server-only imports
 * into no-ops, as for the seed; the statistics APIs are called directly, one goal at a time):
 *   yarn tsx --conditions=react-server scripts/prisma/fill-national-historical.ts                # markdown report, writes nothing
 *   yarn tsx --conditions=react-server scripts/prisma/fill-national-historical.ts --sql > x.sql  # one transaction to run on the target db
 *   yarn tsx --conditions=react-server scripts/prisma/fill-national-historical.ts --write        # write straight to DATABASE_URL
 *   --roadmap <text>  only goals of national roadmaps whose name contains the text (prod has several
 *                     national scenarios; the seeded LEAP one is "Scenario Lokal miljöhänsyn från Energimyndigheten")
 *   --only <text>     only goals whose indicator parameter contains the text
 *   --author <userId> author for series and recipes when neither the goal nor its roadmap has one
 *
 * The SQL route exists because bulk prod writes go over ssh as generated SQL (see the prod runbook).
 */
import { prisma } from "@/lib/prisma";
import { fetchExternalVariableData } from "@/functions/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import getPxWebTableContent from "@/lib/api/pxWeb/getPxWebTableContent";
import getTrafaTableContent from "@/lib/api/trafa/getTrafaTableContent";
import { ExternalDataset } from "@/lib/api/utility";
import { getLeapNationalSource } from "@/lib/leapNationalSeries";
import { RoadmapType } from "@/lib/prisma/generated";
import { UnitFlags } from "@/types/enums";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import type { ExternalVariable } from "@/functions/recipe";
import type { ApiSelectionItem, ApiTableContent } from "@/lib/api/apiTypes";
import { fillPlanToReport, fillPlanToSql, planGoalHistorical } from "../lib/nationalHistorical";
import type { NationalGoal, PlannedFill, SkippedGoal } from "../lib/nationalHistorical";

/** The unguarded fetchers: no session to rate-limit here, and no cache scope. */
async function getTableContent(tableId: string, dataset: string, selection: ApiSelectionItem[]): Promise<ApiTableContent | null> {
  const api = ExternalDataset.getDatasetByAlternateName(dataset)?.api;
  if (api === "PxWeb") return getPxWebTableContent(tableId, dataset, selection);
  if (api === "Trafa") return getTrafaTableContent(tableId, selection);
  return null;
}

function argValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}

async function main() {
  // The fetchers log retries with console.debug; stdout is the report or the SQL
  console.debug = (...data: unknown[]) => console.error(...data);
  const args = process.argv.slice(2);
  const emitSql = args.includes("--sql");
  const write = args.includes("--write");
  const only = argValue(args, "--only");
  const roadmap = argValue(args, "--roadmap");
  const fallbackAuthor = argValue(args, "--author");

  const goals = await prisma.goals.findMany({
    where: {
      historical_id: null,
      roadmap_iteration: { roadmap: { type: RoadmapType.NATIONAL, ...(roadmap ? { name: { contains: roadmap } } : {}) } },
      ...(only ? { indicator_parameter: { contains: only } } : {}),
    },
    select: {
      id: true,
      name: true,
      indicator_parameter: true,
      author_id: true,
      data_series: { select: { unit: true } },
      roadmap_iteration: { select: { roadmap: { select: { name: true, author_id: true, access_control: { select: { org_id: true } } } } } },
    },
    orderBy: { indicator_parameter: "asc" },
  });

  const plans: PlannedFill[] = [];
  const skipped: SkippedGoal[] = [];
  for (const row of goals) {
    const goal: NationalGoal = {
      id: row.id,
      name: row.name,
      indicator_parameter: row.indicator_parameter,
      authorId: row.author_id ?? row.roadmap_iteration.roadmap.author_id ?? fallbackAuthor,
      orgId: row.roadmap_iteration.roadmap.access_control.org_id,
      roadmapName: row.roadmap_iteration.roadmap.name,
      unit: row.data_series?.unit ?? null,
    };
    const source = getLeapNationalSource(goal.indicator_parameter);
    if (!source) { skipped.push({ goal, reason: "ingen nationell statistik för raden" }); continue; }
    if (!goal.authorId) { skipped.push({ goal, reason: "ingen författare (ge --author)" }); continue; }

    const variable: ExternalVariable = {
      id: "national-statistic",
      name: goal.name ?? goal.indicator_parameter,
      type: RecipeDataTypes.External,
      dataset: source.dataset,
      tableId: source.tableId,
      selection: source.selection,
      pick: VectorIndexPickerOptions.Default,
      unit: UnitFlags.Missing,
    };
    try {
      const warnings: string[] = [];
      const fetched = await fetchExternalVariableData(variable, warnings, getTableContent);
      // Empty cells (years the statistic doesn't cover) are expected; anything else is worth seeing
      const notable = warnings.filter(warning => !/non-numeric value ""/.test(warning));
      if (notable.length) console.error(`${goal.indicator_parameter}: ${notable.join("; ")}`);
      if (Object.keys(fetched.dateValues).length === 0) { skipped.push({ goal, reason: "statistiken är tom" }); continue; }
      plans.push(planGoalHistorical(goal, source, fetched));
    } catch (err) {
      console.error(`${goal.indicator_parameter}: ${err instanceof Error ? err.message : String(err)}`);
      skipped.push({ goal, reason: "hämtningen misslyckades" });
    }
    // The statistics APIs answer bursts with 429s
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (emitSql) {
    process.stdout.write(fillPlanToSql(plans));
    return;
  }
  process.stdout.write(fillPlanToReport(plans, skipped));
  if (!write) return;

  for (const plan of plans) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.goals.findUniqueOrThrow({ where: { id: plan.goal.id }, select: { historical_id: true } });
      if (current.historical_id) return;
      for (const series of [plan.fetched, plan.historical]) {
        await tx.dataSeries.create({
          data: {
            id: series.id,
            org: { connect: { id: plan.goal.orgId } },
            author: { connect: { id: plan.goal.authorId as string } },
            unit: series.unit,
            values: { createMany: { data: dateValuesToDBDateRecord(series.dateValues) } },
            recipe_used: {
              create: {
                id: series.recipeId,
                recipe: series.recipe,
                org: { connect: { id: plan.goal.orgId } },
                ...(series === plan.historical ? { source_data_series: { connect: [{ id: plan.fetched.id }] } } : {}),
              },
            },
          },
        });
      }
      await tx.goals.update({ where: { id: plan.goal.id }, data: { historical: { connect: { id: plan.historical.id } } } });
    });
  }
  console.error(`Skrev historik för ${plans.length} mål.`);
}

// @/lib/prisma installs an uncaughtException handler that would swallow failures and exit 0
main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
