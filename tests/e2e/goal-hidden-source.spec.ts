import path from "node:path";
import { cwd } from "node:process";
import type { Page } from "playwright/test";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, groupIdByName, orgIdByName, pageEntity, pageEntityWhen, postJson, seriesValues, Seed, uniqueLabel, yearlyDateValues } from "../lib/api";
import { expect, test as base } from "../lib/fixtures";
import { submitForm, visible, waitForRecipeFormSyncs } from "../lib/forms";
import { recordPageErrors } from "../lib/page-errors";

const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/*
 * The goal form for someone who may edit a goal but not see the goal it was computed from (a
 * copy in a roadmap anita's group edits, of a goal under a roadmap only the org's managers
 * read). The form gets the copy's values and neither the recipe nor the series it reads (see
 * tests/api/source-series-visibility.spec.ts), so it has nothing to recompute the series from.
 * What matters here is that it stays safe: it opens, it does not save a series it could not
 * evaluate, and replacing the calculation with the stored values by hand goes through.
 */

const SOURCE_SERIES = [616161.5, 626262.5, 636363.5];
const COPY_SERIES = SOURCE_SERIES.map(value => value * 2);

type Workspace = { label: string, copyId: string, originalName: string, originalSeriesId: string };

const test = base.extend<{ workspace: Workspace }>({
  workspace: async ({ admin }, use, testInfo) => {
    const label = uniqueLabel(testInfo);
    const orgId = await orgIdByName(admin, Seed.orgName);
    const groupId = await groupIdByName(admin, orgId, Seed.groupName);
    const editableRoadmapId = await createRoadmap(admin, orgId, { name: `Editable ${label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    const closedRoadmapId = await createRoadmap(admin, orgId, { name: `Closed ${label}`, access: { sharing: "GROUPS", grants: [] } });
    try {
      const originalName = `Closed original ${label}`;
      const originalId = await createGoal(admin, await createIteration(admin, closedRoadmapId), { name: originalName, dateValues: yearlyDateValues(SOURCE_SERIES) });
      const originalSeriesId = (await pageEntity(admin, `/goal/${originalId}`, originalId))?.data_series_id as string;
      // The recipe the goal form stores for a copy: a variable labelled with the original's name, which the equation refers to
      const { id: copyId } = await postJson(admin, "/api/goal", {
        target: "FULL", iterationId: await createIteration(admin, editableRoadmapId), name: `Copy ${label}`, description: null, indicatorParameter: `Copy\\${label}`, rawTags: null,
        dataSeriesRecipe: JSON.stringify({
          name: "Scaled copy",
          equation: `\${${originalName}} * \${Factor}`,
          variables: [
            { id: "parent", name: originalName, type: "data-series", pick: "whole", unit: "MISSING_UNIT", dataSeriesId: originalSeriesId, value: null },
            { id: "factor", name: "Factor", type: "scalar", unit: "UNITLESS", value: 2 },
          ],
          unit: "ton",
          meta: { v: 1, isSuggestedRecipe: true, isManual: false },
        }),
        dataSeries: { unit: "ton", dateValues: yearlyDateValues(COPY_SERIES) },
      });
      await use({ label, copyId: copyId ?? "", originalName, originalSeriesId });
    }
    finally {
      await deleteRoadmap(admin, editableRoadmapId);
      await deleteRoadmap(admin, closedRoadmapId);
    }
  },
});

function goalForm(page: Page) {
  return visible(page, 'form[name="goalForm"]');
}

test.describe("editing a goal computed from a goal the editor cannot see", () => {
  test.use({ storageState: verifiedFile });

  test("the form opens without the calculation, refuses to save the series, and saves it once entered by hand", async ({ page, admin, workspace }) => {
    test.slow();
    const errors = recordPageErrors(page);

    await page.goto(`/goal/${workspace.copyId}/edit`);
    await expect(visible(page, "#goalName")).toHaveValue(`Copy ${workspace.label}`, { timeout: 60_000 });
    await waitForRecipeFormSyncs(page);

    // Nothing of the original reached the browser: not in the page, not in what the form holds
    const html = await page.content();
    expect(html.includes(workspace.originalName), "the original's name").toBe(false);
    expect(html.includes(workspace.originalSeriesId), "the original's series id").toBe(false);
    expect(html.includes(String(SOURCE_SERIES[0])), "the original's values").toBe(false);

    // The calculation is not there to save: the submit stops in the form, no request leaves
    let saves = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/goal" && request.method() === "PUT") saves++;
    });
    await visible(page, "#submit-button").click();
    await expect(page.getByTestId("toast-list").locator('dialog[role="alert"]').filter({ hasText: "goal.errors.recipe_has_error" })).toBeVisible({ timeout: 30_000 });
    expect(saves, "saves sent").toBe(0);
    await expect(goalForm(page)).toBeVisible();
    const afterRefusal = await pageEntity(admin, `/goal/${workspace.copyId}`, workspace.copyId);
    expect(seriesValues(afterRefusal?.data_series), "the stored values").toEqual(COPY_SERIES);
    expect(((afterRefusal?.data_series as { recipe_used: { source_data_series: { id: string }[] } }).recipe_used.source_data_series).map(source => source.id), "the stored recipe still reads the original").toEqual([workspace.originalSeriesId]);

    // The way out the form offers today: the stored values as a hand-entered series (the grid starts with them)
    await goalForm(page).locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await expect(visible(page, '#goal-dataseries [data-row="0"][data-column="2"] input')).toHaveValue(String(COPY_SERIES[0]), { timeout: 30_000 });
    await waitForRecipeFormSyncs(page);
    expect(await submitForm(page, "/api/goal", "PUT"), "the save").toBe(200);
    const saved = await pageEntityWhen(admin, `/goal/${workspace.copyId}`, workspace.copyId,
      goal => ((goal?.data_series as { recipe_used: { source_data_series: unknown[] } } | undefined)?.recipe_used.source_data_series ?? [null]).length === 0, "the hand-entered series");
    expect(seriesValues(saved?.data_series), "the values survive the change").toEqual(COPY_SERIES);

    // No crash. (console.error is not asserted on: the formula editor the form opens loads every
    // readable roadmap for its series picker, and the navigation after the save cuts those requests short)
    expect((await errors.settled()).filter(message => message.startsWith("pageerror:")), "uncaught exceptions").toEqual([]);
  });
});
