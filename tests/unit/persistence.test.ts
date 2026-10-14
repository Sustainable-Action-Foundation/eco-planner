import { expect, test } from "playwright/test";

import { manualDataSeriesCreateData } from "../../src/functions/recipe/manualDataSeries";
import { Recipe } from "../../src/functions/recipe/recipe";
import type { DataSeriesVariable } from "../../src/functions/recipe/types";
import type { DateValuesWithUnit, ISOIshDate } from "../../src/types";
import { parseUnit } from "../../src/functions/unit";
import { UnitFlags } from "../../src/types/enums";

/*
 * The one pure function of src/functions/recipe/persistence.ts. It lives in
 * manualDataSeries.ts because persistence.ts imports `server-only` (which
 * throws outside a React server environment) and the Prisma client, neither
 * of which the unit runner can load; persistence.ts re-exports it.
 */

const isoYear = (year: number): ISOIshDate => `${year}-01-01T00:00:00.000Z`;

const dateValues: DateValuesWithUnit = { unit: parseUnit("kg"), dateValues: { [isoYear(2020)]: 1.5, [isoYear(2021)]: 2 } };

test.describe("manualDataSeriesCreateData", () => {
  test("connects the series and its recipe to the org and the author", () => {
    const data = manualDataSeriesCreateData(dateValues, "org-1", "user-1");
    expect(data.org).toEqual({ connect: { id: "org-1" } });
    expect(data.author).toEqual({ connect: { id: "user-1" } });
    expect(data.recipe_used.create.org).toEqual({ connect: { id: "org-1" } });
  });

  test("stores the values as timestamped records", () => {
    const data = manualDataSeriesCreateData(dateValues, "org-1", "user-1");
    expect(data.values.createMany.data).toEqual([
      { timestamp: new Date(isoYear(2020)), value: 1.5 },
      { timestamp: new Date(isoYear(2021)), value: 2 },
    ]);
  });

  test("serializes the unit with the db convention", () => {
    expect(manualDataSeriesCreateData(dateValues, "o", "u").unit).toBe("kg");
    expect(manualDataSeriesCreateData({ ...dateValues, unit: UnitFlags.Unitless }, "o", "u").unit).toBeNull();
    expect(manualDataSeriesCreateData({ ...dateValues, unit: UnitFlags.Missing }, "o", "u").unit).toBe("");
  });

  test("the producing recipe is a manual recipe that inlines the values and evaluates back to them", async () => {
    const data = manualDataSeriesCreateData(dateValues, "org-1", "user-1");
    const recipe = Recipe.deserialize(data.recipe_used.create.recipe);

    expect(recipe.isManual()).toBe(true);
    expect(recipe.unit).toBe("kg");
    expect(recipe.variables).toHaveLength(1);
    expect((recipe.variables[0] as DataSeriesVariable).value).toEqual(dateValues.dateValues);
    expect(await recipe.evaluate([])).toEqual(dateValues);
  });

  test("an empty series still produces valid create data", () => {
    const data = manualDataSeriesCreateData({ unit: UnitFlags.Unitless, dateValues: {} }, "org-1", "user-1");
    expect(data.values.createMany.data).toEqual([]);
    expect(Recipe.deserialize(data.recipe_used.create.recipe).isManual()).toBe(true);
  });
});
