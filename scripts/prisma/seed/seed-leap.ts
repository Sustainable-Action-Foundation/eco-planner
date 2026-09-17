// Seeds the national LEAP scenario and each place's scaled copy of it.
//
// The scenario ("LEAP Lokal miljöhänsyn", as on prod) is imported from its
// export the way the roadmap form imports a goal CSV: one goal per row with a
// manual series, rows flagged hidden as unlisted goals. Rows a national statistic
// measures directly get that statistic as historical data (the same shape
// scripts/prisma/fill-national-historical.ts writes on prod).
//
// Every place with `leapCopy` gets a roadmap under the scenario whose version 1
// holds a copy of each goal scaled to the place the way the goal form would
// scale it (see scripts/lib/leapCopyPlan.ts): by a curated local statistic
// where the catalog has one, else by the row's LEAP scaling rule, else by
// population. The statistics come from the committed snapshot
// (scripts/lib/statisticsSnapshot.ts), never from the network.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { csvToGoalList, parseGoalCsv } from "@/functions/parseGoalCsv";
import { Recipe } from "@/functions/recipe/recipe";
import { externalSelectionKey } from "@/functions/recipe/extractors";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { parseUnit, serializeUnit } from "@/functions/unit";
import { getLeapNationalSource } from "@/lib/leapNationalSeries";
import { GoalListing, IterationStatus, RoadmapType, Sharing } from "@/lib/prisma/generated";
import type { Prisma, RoadmapIterations, Roadmaps } from "@/lib/prisma/generated";
import { UnitFlags } from "@/types/enums";
import type { DateValues, GeoAreaRef } from "@/types";
import type { TFunction } from "i18next";
import { planGoalHistorical } from "../../lib/nationalHistorical";
import type { PlannedSeries } from "../../lib/nationalHistorical";
import { ExternalRegistry, planCopy, seriesGetter } from "../../lib/leapCopyPlan";
import type { CopyMethod, NationalGoalSeed, PlannedCopy } from "../../lib/leapCopyPlan";
import { loadSnapshot, snapshotDateValues } from "../../lib/statisticsSnapshot";
import type { StatisticsSnapshot } from "../../lib/statisticsSnapshot";
import { colors } from "../../lib/colors.ts";
import type { SeededUsers } from "./helpers.ts";
import { getRandomDateInThePast } from "./helpers.ts";
import { LEAP_CSV_PATH, placeArea } from "./places-geo.ts";

export type SeededLeap = {
  national: { roadmap: Roadmaps, iteration: RoadmapIterations, goals: NationalGoalSeed[] };
  /** Per place org id: the roadmap and version holding its copy, or its empty draft */
  byOrg: Record<string, { roadmap: Roadmaps, iteration: RoadmapIterations, goalIds: string[] }>;
};

/** Rows to insert, gathered per org and written in bulk (a few createMany calls instead of one create per goal) */
type Batch = {
  recipes: Prisma.RecipesCreateManyInput[];
  /** Recipes that read other series: created one by one, since the implicit relation can't be bulk-inserted */
  linkedRecipes: { id: string, recipe: string, sourceIds: string[] }[];
  series: Prisma.DataSeriesCreateManyInput[];
  records: Prisma.DateRecordsCreateManyInput[];
  goals: Prisma.GoalsCreateManyInput[];
};

const CHUNK = 2000;

/**
 * Recipes first (a series needs its producing recipe), then the series and their
 * values, then the source links (a recipe's sources are series, some of them in
 * this very batch), then the goals.
 */
async function writeBatch(batch: Batch, orgId: string): Promise<void> {
  const linkedRows = batch.linkedRecipes.map(linked => ({ id: linked.id, org_id: orgId, recipe: linked.recipe }));
  for (const chunk of chunks([...batch.recipes, ...linkedRows])) await prisma.recipes.createMany({ data: chunk });
  for (const chunk of chunks(batch.series)) await prisma.dataSeries.createMany({ data: chunk });
  for (const chunk of chunks(batch.records)) await prisma.dateRecords.createMany({ data: chunk });
  for (const linked of batch.linkedRecipes) {
    await prisma.recipes.update({
      where: { id: linked.id },
      data: { source_data_series: { connect: linked.sourceIds.map(id => ({ id })) } },
      select: { id: true },
    });
  }
  for (const chunk of chunks(batch.goals)) await prisma.goals.createMany({ data: chunk });
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

function emptyBatch(): Batch {
  return { recipes: [], linkedRecipes: [], series: [], records: [], goals: [] };
}

/** Queues a series with its values, produced by an already-queued recipe */
function queueSeries(batch: Batch, series: { id: string, recipeId: string, unit: string | null, dateValues: DateValues }, orgId: string, authorId: string): void {
  batch.series.push({ id: series.id, org_id: orgId, author_id: authorId, unit: series.unit, recipe_used_id: series.recipeId });
  batch.records.push(...dateValuesToDBDateRecord(series.dateValues, series.id) as Prisma.DateRecordsCreateManyInput[]);
}

export async function seedLeap(users: SeededUsers, t: TFunction): Promise<SeededLeap> {
  const snapshot = loadSnapshot();
  if (!snapshot) throw new Error(`Missing ${path.join("scripts", "prisma", "seed", "data", "statistics-snapshot.json")}; run scripts/prisma/refresh-seed-statistics.ts`);

  const national = await seedNationalScenario(users, snapshot);
  const byOrg: SeededLeap["byOrg"] = {};

  const nationalById = new Map(national.goals.map(goal => [goal.dataSeriesId, goal]));
  for (const { place, org, members } of users.places) {
    const area = placeArea(place);
    const author = members[0];
    const roadmap = await prisma.roadmaps.create({
      data: {
        name: place.roadmapName,
        description: place.leapCopy
          ? `Färdplan för ${area.name} med utgångspunkt i det nationella scenariot ${national.roadmap.name}: varje målbana är skalad till ${area.name} utifrån lokal statistik, scenariots skalningsregler eller befolkning.`
          : `Färdplan för ${area.name}. Målbanorna hämtas från det nationella scenariot ${national.roadmap.name} när arbetet börjar.`,
        actor: place.name,
        geo_area: { connect: { code: place.geoCode } },
        type: place.roadmapType,
        author: { connect: { id: author.id } },
        parent_roadmap: { connect: { id: national.roadmap.id } },
        access_control: { create: { org: { connect: { id: org.id } }, sharing: place.sharing } },
      },
    });
    const iteration = await prisma.roadmapIterations.create({
      data: {
        version: 1,
        author: { connect: { id: author.id } },
        roadmap: { connect: { id: roadmap.id } },
        target_version: national.iteration.version,
        ...(place.leapCopy
          ? { description: `Kopia av ${national.roadmap.name} version ${national.iteration.version}, skalad till ${area.name}.`, status: IterationStatus.PUBLISHED, published_at: getRandomDateInThePast() }
          : { description: "Ett tomt utkast att fylla med målbanor.", status: IterationStatus.DRAFT }),
      },
    });

    if (!place.leapCopy) {
      byOrg[org.id] = { roadmap, iteration, goalIds: [] };
      continue;
    }

    const goalIds = await seedCopies(t, { orgId: org.id, authorId: author.id, iterationId: iteration.id, area, goals: national.goals, nationalById, snapshot });
    byOrg[org.id] = { roadmap, iteration, goalIds };
  }

  return { national, byOrg };
}

/** The scenario's goals from the export, with history from the national statistics in the snapshot */
async function seedNationalScenario(users: SeededUsers, snapshot: StatisticsSnapshot): Promise<SeededLeap["national"]> {
  const { admin, org } = users;
  const csv = fs.readFileSync(path.join(process.cwd(), LEAP_CSV_PATH));
  const rows = csvToGoalList(parseGoalCsv(csv.buffer.slice(csv.byteOffset, csv.byteOffset + csv.byteLength)));

  const roadmap = await prisma.roadmaps.create({
    data: {
      name: "LEAP Lokal miljöhänsyn",
      description: "Nationellt scenario för Sveriges energi- och klimatomställning, modellerat i LEAP. Målbanorna beskriver riket som helhet och är tänkta att brytas ner till regioner och kommuner: kopiera dem till en egen färdplan så föreslås skalningsmetoder per målbana.",
      actor: "Sverige",
      geo_area: { connect: { code: "00" } },
      type: RoadmapType.NATIONAL,
      author: { connect: { id: admin.id } },
      access_control: { create: { org: { connect: { id: org.id } }, sharing: Sharing.PUBLIC } },
    },
  });
  const iteration = await prisma.roadmapIterations.create({
    data: {
      version: 1,
      author: { connect: { id: admin.id } },
      roadmap: { connect: { id: roadmap.id } },
      description: "Export ur LEAP 2026-07-08, scenariot Lokal miljöhänsyn.",
      status: IterationStatus.PUBLISHED,
      published_at: getRandomDateInThePast(),
    },
  });

  const batch = emptyBatch();
  const goals: NationalGoalSeed[] = [];
  let withHistory = 0;
  for (const row of rows) {
    if (!row.dataSeries) continue;
    const goal: NationalGoalSeed = {
      id: randomUUID(),
      name: null,
      description: null,
      indicatorParameter: row.indicatorParameter,
      listing: row.listing ?? GoalListing.LISTED,
      unit: serializeUnit(row.dataSeries.unit),
      dataSeriesId: randomUUID(),
      dateValues: row.dataSeries.dateValues,
    };
    goals.push(goal);

    // The series as the CSV import stores it: manual input through an inline recipe
    const recipeId = randomUUID();
    batch.recipes.push({ id: recipeId, org_id: org.id, recipe: Recipe.fromManualDateValues(row.dataSeries).serialize() });
    queueSeries(batch, { id: goal.dataSeriesId, recipeId, unit: goal.unit, dateValues: goal.dateValues }, org.id, admin.id);

    // History from the national statistic that measures the row, when the snapshot has it
    let historicalId: string | null = null;
    const source = getLeapNationalSource(goal.indicatorParameter);
    const statistic = source ? snapshot.series[externalSelectionKey(source.dataset, source.tableId, source.selection)] : null;
    if (source && statistic && Object.keys(statistic.values).length > 0) {
      const plan = planGoalHistorical(
        { id: goal.id, name: goal.name, indicator_parameter: goal.indicatorParameter, authorId: admin.id, orgId: org.id, roadmapName: roadmap.name, unit: goal.unit },
        source,
        // The fetch keeps the statistic unitless like the live fill does; the historical recipe declares the goal's unit
        { dateValues: snapshotDateValues(statistic), unit: UnitFlags.Unitless },
      );
      queuePlanned(batch, plan.fetched, [], org.id, admin.id);
      queuePlanned(batch, plan.historical, [plan.fetched.id], org.id, admin.id);
      historicalId = plan.historical.id;
      withHistory++;
    }

    batch.goals.push({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      indicator_parameter: goal.indicatorParameter,
      listing: goal.listing,
      author_id: admin.id,
      roadmap_iteration_id: iteration.id,
      data_series_id: goal.dataSeriesId,
      historical_id: historicalId,
    });
  }
  await writeBatch(batch, org.id);
  console.info(colors.green(`${roadmap.name}: ${goals.length} målbanor, ${withHistory} med historik från statistiken`));
  return { roadmap, iteration, goals };
}

function queuePlanned(batch: Batch, series: PlannedSeries, sourceIds: string[], orgId: string, authorId: string): void {
  if (sourceIds.length) batch.linkedRecipes.push({ id: series.recipeId, recipe: series.recipe, sourceIds });
  else batch.recipes.push({ id: series.recipeId, org_id: orgId, recipe: series.recipe });
  queueSeries(batch, { id: series.id, recipeId: series.recipeId, unit: series.unit, dateValues: series.dateValues }, orgId, authorId);
}

type CopyContext = {
  orgId: string;
  authorId: string;
  iterationId: string;
  area: GeoAreaRef;
  goals: NationalGoalSeed[];
  nationalById: Map<string, NationalGoalSeed>;
  snapshot: StatisticsSnapshot;
};

/** Every national goal copied into the area, scaled by the first method that works; returns the created goal ids */
async function seedCopies(t: TFunction, context: CopyContext): Promise<string[]> {
  const { orgId, authorId, iterationId, area, snapshot } = context;
  const registry = new ExternalRegistry(snapshot);
  const getSeries = seriesGetter(context.nationalById, registry);

  const planned: PlannedCopy[] = [];
  const counts: Partial<Record<CopyMethod, number>> = {};
  const skipped: { goal: NationalGoalSeed, failures: string[] }[] = [];
  for (const goal of context.goals) {
    const result = await planCopy(t, goal, area, snapshot, registry, getSeries);
    if (!result.planned) { skipped.push({ goal, failures: result.failures }); continue; }
    planned.push(result.planned);
    counts[result.planned.method] = (counts[result.planned.method] ?? 0) + 1;
  }

  const batch = emptyBatch();
  // The org's materialized statistics first: the copies' recipes read them
  for (const external of registry.all()) {
    batch.recipes.push({ id: external.recipeId, org_id: orgId, recipe: external.recipe });
    queueSeries(batch, { id: external.id, recipeId: external.recipeId, unit: external.unit, dateValues: external.dateValues }, orgId, authorId);
  }

  const goalIds: string[] = [];
  for (const copy of planned) {
    const goalId = randomUUID();
    goalIds.push(goalId);
    const unit = serializeUnit(copy.series.unit);

    const seriesId = randomUUID();
    const recipeId = randomUUID();
    batch.linkedRecipes.push({ id: recipeId, recipe: copy.recipe, sourceIds: copy.sourceIds });
    queueSeries(batch, { id: seriesId, recipeId, unit, dateValues: copy.series.dateValues }, orgId, authorId);

    // A first-value baseline, as the form gives a copy
    const baselineId = randomUUID();
    const baselineRecipeId = randomUUID();
    batch.recipes.push({ id: baselineRecipeId, org_id: orgId, recipe: Recipe.fromInitialDateValue(copy.series).serialize() });
    queueSeries(batch, { id: baselineId, recipeId: baselineRecipeId, unit, dateValues: initialValueBaseline(copy.series.dateValues) }, orgId, authorId);

    // The local statistic as history when the copy follows one: a series reading the org's materialized statistic
    let historicalId: string | null = null;
    if (copy.historical) {
      historicalId = randomUUID();
      const historicalRecipeId = randomUUID();
      const variableId = randomUUID();
      const historicalUnit = parseUnit(copy.historical.unit);
      const historicalName = Recipe.from(copy.historical.recipe).name;
      const recipe = new Recipe({
        name: historicalName,
        equation: `\${${variableId}}`,
        variables: [{
          id: variableId,
          name: historicalName,
          type: RecipeDataTypes.DataSeries,
          unit: historicalUnit,
          pick: VectorIndexPickerOptions.Default,
          dataSeriesId: copy.historical.id,
          value: undefined,
          externalSource: { dataset: copy.historical.dataset, tableId: copy.historical.tableId, selection: copy.historical.selection },
        }],
        unit: historicalUnit,
      });
      batch.linkedRecipes.push({ id: historicalRecipeId, recipe: recipe.serialize(), sourceIds: [copy.historical.id] });
      queueSeries(batch, { id: historicalId, recipeId: historicalRecipeId, unit: copy.historical.unit, dateValues: copy.historical.dateValues }, orgId, authorId);
    }

    batch.goals.push({
      id: goalId,
      name: copy.goal.name,
      description: copy.goal.description,
      indicator_parameter: copy.goal.indicatorParameter,
      listing: copy.goal.listing,
      author_id: authorId,
      roadmap_iteration_id: iterationId,
      data_series_id: seriesId,
      baseline_id: baselineId,
      historical_id: historicalId,
    });
  }
  await writeBatch(batch, orgId);

  const summary = Object.entries(counts).map(([method, count]) => `${method.toLowerCase()} ${count}`).join(", ");
  console.info(colors.green(`${area.name}: ${planned.length} målbanor kopierade (${summary}), ${skipped.length} hoppade över, ${registry.all().length} statistikserier`));
  for (const { goal, failures } of skipped) console.warn(colors.yellow(`  hoppade över ${goal.indicatorParameter}: ${failures.join("; ")}`));
  return goalIds;
}

/** Every year of the series at its first value: what the initial-value baseline recipe evaluates to */
function initialValueBaseline(dateValues: DateValues): DateValues {
  const entries = Object.entries(dateValues).sort(([a], [b]) => a.localeCompare(b));
  const first = entries[0][1];
  return Object.fromEntries(entries.map(([date]) => [date, first]));
}
