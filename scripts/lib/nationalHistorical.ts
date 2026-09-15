/**
 * Planning half of the national historical fill (see scripts/prisma/fill-national-historical.ts).
 * Pure: takes a national goal, the statistic that measures its LEAP row and the fetched
 * values, and decides exactly what to store, the same shape the goal form stores when a
 * historical series comes from an external source:
 *
 * - a DataSeries with the fetched values as they are, produced by a single-variable
 *   "external fetch" recipe whose variable keeps the selection as `externalSource`
 *   (what `materializeRecipeExternals` writes, and what `getHistoricalSource` reads back);
 * - the goal's historical DataSeries in the goal's own unit, produced by a recipe over
 *   the fetched series: `${x}` when the units agree, `${x} * ${scale}` when the statistic
 *   needs converting (TJ to TWh, kWh/100 km to kWh/km, ...).
 */

import { randomUUID } from "node:crypto";
import { Recipe } from "@/functions/recipe";
import { RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe/types/enums";
import { parseUnit, serializeUnit } from "@/functions/unit";
import { UnitFlags } from "@/types/enums";
import type { DataSeriesVariable, ScalarVariable, SerializedRecipe } from "@/functions/recipe";
import type { LeapNationalSource } from "@/lib/leapNationalSeries";
import type { DateValues, DateValuesWithUnit } from "@/types";

export type NationalGoal = {
  id: string;
  name: string | null;
  indicator_parameter: string;
  /** The goal's own author, else the roadmap's; the series and recipes are written in their name */
  authorId: string | null;
  /** The org owning the roadmap (its access control), which owns the series and recipes */
  orgId: string;
  roadmapName: string;
  /** The unit of the goal's own series, kept on the historical series */
  unit: string | null;
};

export type PlannedSeries = {
  id: string;
  recipeId: string;
  recipe: SerializedRecipe;
  unit: string | null;
  dateValues: DateValues;
};

export type PlannedFill = {
  goal: NationalGoal;
  source: LeapNationalSource;
  /** The statistic as fetched */
  fetched: PlannedSeries;
  /** The goal's historical series, in the goal's unit */
  historical: PlannedSeries;
};

export type SkippedGoal = { goal: Pick<NationalGoal, "id" | "name" | "indicator_parameter" | "roadmapName">, reason: string };

/** The two series and recipes that give `goal` the statistic as historical data. */
export function planGoalHistorical(goal: NationalGoal, source: LeapNationalSource, fetched: DateValuesWithUnit): PlannedFill {
  const variableId = randomUUID();
  const name = goal.name ?? goal.indicator_parameter.split("\\").at(-1) ?? goal.indicator_parameter;
  const externalSource = { dataset: source.dataset, tableId: source.tableId, selection: source.selection };
  const fetchedId = randomUUID();

  const fetchVariable: DataSeriesVariable = {
    id: variableId,
    name,
    type: RecipeDataTypes.DataSeries,
    unit: fetched.unit,
    pick: VectorIndexPickerOptions.Default,
    dataSeriesId: null,
    value: fetched.dateValues,
    externalSource,
  };
  const fetchRecipe = new Recipe({ name, equation: `\${${variableId}}`, variables: [fetchVariable], unit: fetched.unit });

  const goalUnit = goal.unit === null ? UnitFlags.Unitless : parseUnit(goal.unit);
  const sourceVariable: DataSeriesVariable = {
    id: variableId,
    name,
    type: RecipeDataTypes.DataSeries,
    unit: fetched.unit,
    pick: VectorIndexPickerOptions.Default,
    dataSeriesId: fetchedId,
    value: undefined,
    externalSource,
  };
  const scaleVariable: ScalarVariable = { id: "omrakning", name: "omräkning", type: RecipeDataTypes.Scalar, value: source.scale, unit: UnitFlags.Unitless };
  const historicalRecipe = source.scale === 1
    ? new Recipe({ name, equation: `\${${variableId}}`, variables: [sourceVariable], unit: goalUnit })
    : new Recipe({ name, equation: `\${${variableId}} * \${${scaleVariable.id}}`, variables: [sourceVariable, scaleVariable], unit: goalUnit });

  const scaled: DateValues = Object.fromEntries(Object.entries(fetched.dateValues).map(([date, value]) => [date, value * source.scale]));

  return {
    goal,
    source,
    fetched: { id: fetchedId, recipeId: randomUUID(), recipe: fetchRecipe.serialize(), unit: serializeUnit(fetched.unit), dateValues: fetched.dateValues },
    historical: { id: randomUUID(), recipeId: randomUUID(), recipe: historicalRecipe.serialize(), unit: serializeUnit(goalUnit), dateValues: scaled },
  };
}

function sqlString(value: string | null): string {
  return value === null ? "NULL" : `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}
function sqlDate(isoIsh: string): string {
  return sqlString(new Date(isoIsh).toISOString().slice(0, 10));
}

/** One transaction that stores every planned fill; the goal update is guarded so a goal filled meanwhile is left alone. */
export function fillPlanToSql(plans: PlannedFill[]): string {
  const lines: string[] = ["START TRANSACTION;"];
  for (const plan of plans) {
    for (const series of [plan.fetched, plan.historical]) {
      lines.push(`INSERT INTO \`Recipes\` (\`id\`, \`recipe\`, \`org_id\`) VALUES (${sqlString(series.recipeId)}, ${sqlString(JSON.stringify(series.recipe))}, ${sqlString(plan.goal.orgId)});`);
      lines.push(`INSERT INTO \`DataSeries\` (\`id\`, \`created_at\`, \`updated_at\`, \`org_id\`, \`author_id\`, \`unit\`, \`recipe_used_id\`) VALUES (${sqlString(series.id)}, NOW(3), NOW(3), ${sqlString(plan.goal.orgId)}, ${sqlString(plan.goal.authorId)}, ${sqlString(series.unit)}, ${sqlString(series.recipeId)});`);
      const rows = Object.entries(series.dateValues).map(([date, value]) => `(${sqlDate(date)}, ${value}, ${sqlString(series.id)})`);
      if (rows.length > 0) lines.push(`INSERT INTO \`DateRecords\` (\`timestamp\`, \`value\`, \`data_series_id\`) VALUES ${rows.join(", ")};`);
    }
    // The historical recipe reads the fetched series (Prisma's implicit relation table: A = DataSeries, B = Recipes)
    lines.push(`INSERT INTO \`_source_data_series\` (\`A\`, \`B\`) VALUES (${sqlString(plan.fetched.id)}, ${sqlString(plan.historical.recipeId)});`);
    lines.push(`UPDATE \`Goals\` SET \`historical_id\` = ${sqlString(plan.historical.id)} WHERE \`id\` = ${sqlString(plan.goal.id)} AND \`historical_id\` IS NULL;`);
  }
  lines.push("COMMIT;");
  return lines.join("\n") + "\n";
}

function span(dateValues: DateValues): string {
  const years = Object.keys(dateValues).map(date => new Date(date).getUTCFullYear()).sort((a, b) => a - b);
  return years.length === 0 ? "–" : `${years[0]}–${years[years.length - 1]} (${years.length} år)`;
}

/** Markdown summary for a human skim before anything is written */
export function fillPlanToReport(plans: PlannedFill[], skipped: SkippedGoal[]): string {
  const lines: string[] = ["# Nationella mål: historisk data från statistik", ""];
  lines.push(`- Mål som får historik: ${plans.length}`);
  lines.push(`- Mål som hoppas över: ${skipped.length}`);
  lines.push("");
  const byRoadmap = new Map<string, PlannedFill[]>();
  for (const plan of plans) byRoadmap.set(plan.goal.roadmapName, [...(byRoadmap.get(plan.goal.roadmapName) ?? []), plan]);
  for (const [roadmap, own] of byRoadmap) {
    lines.push(`## ${roadmap} (${own.length})`, "");
    lines.push("| Mål | Tabell | Urval | Enhet → mål | År | Senaste |", "|---|---|---|---|---|---|");
    for (const plan of own) {
      const selection = plan.source.selection.map(item => `${item.variableCode}=${item.valueCodes.join(",")}`).join(" ");
      const latest = Object.entries(plan.historical.dateValues).sort(([a], [b]) => a.localeCompare(b)).at(-1);
      const unit = plan.source.scale === 1 ? plan.source.unit : `${plan.source.unit} × ${Number(plan.source.scale.toPrecision(4))} → ${plan.historical.unit || "–"}`;
      lines.push(`| ${plan.goal.name ?? plan.goal.indicator_parameter} | ${plan.source.dataset} ${plan.source.tableId} | \`${selection}\` | ${unit} | ${span(plan.historical.dateValues)} | ${latest ? `${new Date(latest[0]).getUTCFullYear()}: ${Number(latest[1].toPrecision(4))}` : "–"} |`);
    }
    lines.push("");
  }
  if (skipped.length > 0) {
    lines.push("## Hoppas över", "");
    const byReason = new Map<string, SkippedGoal[]>();
    for (const entry of skipped) byReason.set(entry.reason, [...(byReason.get(entry.reason) ?? []), entry]);
    for (const [reason, entries] of byReason) {
      lines.push(`### ${reason} (${entries.length})`);
      for (const entry of entries) lines.push(`- ${entry.goal.roadmapName}: ${entry.goal.name ?? entry.goal.indicator_parameter} \`${entry.goal.id}\``);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}
