import { expect, test } from "playwright/test";
import { fillPlanToReport, fillPlanToSql, planGoalHistorical } from "../../scripts/lib/nationalHistorical";
import type { NationalGoal } from "../../scripts/lib/nationalHistorical";
import { getHistoricalSourceFromRecipe } from "../../src/functions/getHistoricalDataset";
import { Recipe } from "../../src/functions/recipe/recipe";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { getLeapNationalSource } from "../../src/lib/leapNationalSeries";
import { UnitFlags } from "../../src/types/enums";
import type { DateValuesWithUnit } from "../../src/types";

const goal: NationalGoal = {
  id: "00000000-0000-4000-8000-000000000010",
  name: null,
  indicator_parameter: "Key\\Luftfart\\Inrikes\\Bränsleanvändning inrikes flyg",
  authorId: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-000000000002",
  roadmapName: "Lokal miljöhänsyn",
  unit: "TWh",
};
const fetched: DateValuesWithUnit = {
  unit: UnitFlags.Missing,
  dateValues: { "2021-01-01T00:00:00.000Z": 2959, "2022-01-01T00:00:00.000Z": 4460 },
};

test.describe("national historical fill", () => {
  test("stores the statistic as fetched and the goal's series in its unit, scaled", () => {
    const source = getLeapNationalSource(goal.indicator_parameter);
    if (!source) throw new Error("expected a source");
    const plan = planGoalHistorical(goal, source, fetched);

    expect(plan.fetched.dateValues).toEqual(fetched.dateValues);
    expect(plan.historical.dateValues["2021-01-01T00:00:00.000Z"]).toBeCloseTo(2959 / 3600, 6);
    expect(plan.historical.unit).toBe("TWh");

    // The historical recipe reads the fetched series and scales it; both keep the selection discoverable
    const historical = Recipe.from(plan.historical.recipe);
    expect(historical.equation).toMatch(/^\$\{.+\} \* \$\{omrakning\}$/);
    const sourceVariable = historical.variables.find(variable => variable.type === RecipeDataTypes.DataSeries);
    expect(sourceVariable?.type === RecipeDataTypes.DataSeries ? sourceVariable.dataSeriesId : null).toBe(plan.fetched.id);
    expect(getHistoricalSourceFromRecipe(historical)).toMatchObject({ dataset: "STEM", tableId: "EN0118_3" });
    expect(getHistoricalSourceFromRecipe(Recipe.from(plan.fetched.recipe))?.selection).toEqual(source.selection);
    expect(Recipe.from(plan.fetched.recipe).equation).toBe(`\${${sourceVariable?.id}}`);
  });

  test("a statistic already in the goal's unit is wrapped one to one", () => {
    const cars = { ...goal, indicator_parameter: "Key\\Landtransporter\\Personbilar\\Elbilar\\Antal bilar", unit: "" };
    const source = getLeapNationalSource(cars.indicator_parameter);
    if (!source) throw new Error("expected a source");
    const plan = planGoalHistorical(cars, source, fetched);
    expect(Recipe.from(plan.historical.recipe).variables).toHaveLength(1);
    expect(plan.historical.dateValues).toEqual(fetched.dateValues);
  });

  test("the SQL stores both series and only fills goals still without history", () => {
    const source = getLeapNationalSource(goal.indicator_parameter);
    if (!source) throw new Error("expected a source");
    const plan = planGoalHistorical(goal, source, fetched);
    const sql = fillPlanToSql([plan]);
    expect(sql.startsWith("START TRANSACTION;")).toBe(true);
    expect(sql.match(/INSERT INTO `Recipes`/g)).toHaveLength(2);
    expect(sql.match(/INSERT INTO `DataSeries`/g)).toHaveLength(2);
    expect(sql).toContain(`INSERT INTO \`DateRecords\` (\`timestamp\`, \`value\`, \`data_series_id\`) VALUES ('2021-01-01', 2959, '${plan.fetched.id}')`);
    expect(sql).toContain(`INSERT INTO \`_source_data_series\` (\`A\`, \`B\`) VALUES ('${plan.fetched.id}', '${plan.historical.recipeId}');`);
    expect(sql).toContain(`UPDATE \`Goals\` SET \`historical_id\` = '${plan.historical.id}' WHERE \`id\` = '${goal.id}' AND \`historical_id\` IS NULL;`);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  test("the report names the table, selection and conversion per goal, and why goals were skipped", () => {
    const source = getLeapNationalSource(goal.indicator_parameter);
    if (!source) throw new Error("expected a source");
    const report = fillPlanToReport([planGoalHistorical(goal, source, fetched)], [{ goal: { ...goal, indicator_parameter: "Key\\Industri\\Cementindustri\\CCS" }, reason: "ingen nationell statistik för raden" }]);
    expect(report).toContain("STEM EN0118_3");
    expect(report).toContain("Sektor=6");
    expect(report).toContain("2021–2022 (2 år)");
    expect(report).toContain("### ingen nationell statistik för raden (1)");
  });
});
