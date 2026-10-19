import path from "node:path";
import { cwd } from "node:process";
import type { ConsoleMessage, Locator, Page } from "playwright/test";
import { RecipeDataTypes } from "../../src/functions/recipe/types/enums";
import { PARENT_VALUE_ID } from "../../src/components/recipe/suggestions/defaultSuggestedRecipes";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, groupIdByName, orgIdByName, pageEntityWhen, seriesValues, Seed, uniqueLabel, yearlyDateValues } from "../lib/api";
import { expect, test as base } from "../lib/fixtures";
import { fillManualDataSeries, pickSingleSearchOption, pickTreeSeries, recipeFormErrors, visible, waitForRecipeFormSyncs, waitForTreeLoaded } from "../lib/forms";
import { mockStemApi } from "../lib/mocks";

const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/*
 * Goals whose series is computed by a recipe, created through the goal form by
 * anita in a throwaway roadmap her group may edit. Each test gets a parent goal
 * with a known series (seeded through the API), so evaluated values are
 * predictable. Anita rather than the super admin: the form's data-series tree
 * loads every readable roadmap version with its goals, which for the admin
 * (every place's LEAP copies) takes minutes on a loaded dev server.
 */

type Workspace = { label: string, roadmapName: string, iterationId: string, parentName: string };

const parentValues = [10, 20, 30] as const;

const test = base.extend<{ workspace: Workspace }>({
  workspace: async ({ admin }, use, testInfo) => {
    const label = uniqueLabel(testInfo);
    const orgId = await orgIdByName(admin, Seed.orgName);
    const groupId = await groupIdByName(admin, orgId, Seed.groupName);
    const roadmapName = `Recipes ${label}`;
    const roadmapId = await createRoadmap(admin, orgId, { name: roadmapName, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const iterationId = await createIteration(admin, roadmapId);
      const parentName = `Parent ${label}`;
      await createGoal(admin, iterationId, {
        name: parentName,
        indicatorParameter: `Recipe\\${label}\\Parent`,
        unit: "ton",
        dateValues: yearlyDateValues([...parentValues]),
      });
      await use({ label, roadmapName, iterationId, parentName });
    }
    finally {
      await deleteRoadmap(admin, roadmapId);
    }
  },
});

/** The visible goal form */
function goalForm(page: Page) {
  return visible(page, 'form[name="goalForm"]');
}

/** The goal form for the workspace version, as the "new goal" button of its goal table opens it */
function createUrl(workspace: Workspace) {
  return `/goal/create?iterationId=${workspace.iterationId}`;
}

/**
 * Waits for the data-series tree behind `combobox` and picks the workspace
 * parent goal's series in it. When the tree's server action fails the tree
 * keeps showing its loading row forever (only the console says so), so that
 * failure is turned into an error for `openFormAndPick` to start over on.
 */
async function pickParentSeries(page: Page, combobox: Locator, workspace: Workspace) {
  const state = { fetchFailed: false, settled: false };
  const onConsole = (message: ConsoleMessage) => {
    if (message.text().includes("Failed to fetch roadmap data")) state.fetchFailed = true;
  };
  page.on("console", onConsole);
  const loaded = waitForTreeLoaded(page, combobox, 240_000).finally(() => { state.settled = true; });
  const failed = (async () => {
    while (!state.settled && !state.fetchFailed) await new Promise(resolve => setTimeout(resolve, 500));
    if (state.fetchFailed && !state.settled) throw new Error("The data-series tree failed to load");
  })();
  // The loser of the race may still reject (e.g. once the page is left); that is not this attempt's error
  loaded.catch(() => undefined);
  failed.catch(() => undefined);
  try {
    await Promise.race([loaded, failed]);
  }
  finally {
    state.settled = true;
    page.off("console", onConsole);
  }
  await pickTreeSeries(page, combobox, workspace.roadmapName, workspace.parentName);
}

/**
 * Opens the goal form in the workspace and runs `prepare`, which picks the
 * parent series somewhere in the form. The tree's first load after the
 * workspace was created can still be the cached one without it, so a failed
 * attempt starts over from a fresh page.
 */
async function openFormAndPick(page: Page, workspace: Workspace, prepare: () => Promise<void>) {
  await expect(async () => {
    await page.goto(createUrl(workspace));
    await prepare();
  }).toPass({ timeout: 480_000, intervals: [1_000] });
}

/** Submits the visible goal form; resolves with the id of the created goal */
async function submitNewGoal(page: Page): Promise<string> {
  const [response] = await Promise.all([
    page.waitForResponse(res => new URL(res.url()).pathname === "/api/goal" && res.request().method() === "POST", { timeout: 30_000 }),
    visible(page, "#submit-button").click(),
  ]);
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** Clicks submit and asserts the form refused with a toast containing `key`, without calling the API */
async function expectSubmitBlocked(page: Page, key: string) {
  let posted = false;
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/goal" && req.method() === "POST") posted = true;
  });
  await visible(page, "#submit-button").click();
  await expect(page.getByTestId("toast-list").filter({ visible: true })).toContainText(key);
  // The submit handler is past its checks once the button is enabled again
  await expect(visible(page, "#submit-button")).toBeEnabled();
  expect(posted, "the form must not reach the API").toBe(false);
  await expect(page).toHaveURL(/\/goal\/create/);
}

/** Adds a data-series variable named `name` in the custom recipe editor and picks the workspace parent series for it */
async function addSeriesVariable(page: Page, workspace: Workspace, name: string) {
  const form = goalForm(page);
  await form.getByRole("radio", { name: "goal.custom_recipe" }).check();
  await form.getByRole("button", { name: "copy_and_scale.add_variable" }).first().click();
  const popover = visible(page, "#add-variable-popover").first();
  await popover.locator("#variable-name").fill(name);
  await popover.locator(`input[name="variable-type"][value="${RecipeDataTypes.DataSeries}"]`).check();
  await popover.getByRole("button", { name: "recipe_editor.create_variable" }).click();

  await form.getByRole("tab", { name: "recipe_editor.variables", exact: true }).click();
  await pickParentSeries(page, form.locator('[role="combobox"][id^="recipe-data-series-"]').first(), workspace);
  await form.getByRole("tab", { name: "recipe_editor.recipe", exact: true }).click();
}

test.describe("Recipe goals", () => {
  test.use({ storageState: verifiedFile });
  // The goal form's data-series tree is the slowest load in the app (see `waitForTreeLoaded`)
  test.beforeEach(() => test.setTimeout(720_000));

  test("the suggested scalar preset scales the picked parent series", async ({ page, admin, workspace }) => {
    await openFormAndPick(page, workspace, async () => {
      await goalForm(page).locator(`input[name="DATA_SERIES_TYPE"][value="SUGGESTED"]`).check();
      await visible(page, "#select-preset").selectOption(Seed.scalarPresetId);
      await pickParentSeries(page, visible(page, `#recipeVariable-${PARENT_VALUE_ID}`), workspace);
    });
    await goalForm(page).getByPlaceholder("recipe_editor.scalar").fill("3");
    await visible(page, "#goalName").fill(`Scaled ${workspace.label}`);

    await waitForRecipeFormSyncs(page);
    expect(await recipeFormErrors(page)).toEqual([]);
    await expect(goalForm(page).getByText("recipe_editor.no_errors").first()).toBeVisible();

    const goalId = await submitNewGoal(page);
    await expect(page).toHaveURL(`/goal/${goalId}`, { timeout: 30_000 });
    await expect(visible(page, "main h1")).toHaveText(`Scaled ${workspace.label}`, { timeout: 30_000 });

    // The stored series is the parent's times three, and the goal remembers its recipe
    const goal = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, entity => seriesValues(entity?.data_series).length > 0);
    expect(seriesValues(goal?.data_series).slice(0, parentValues.length)).toEqual(parentValues.map(value => value * 3));

    // The edit form reopens on the saved method rather than a blank suggestion
    await page.goto(`/goal/${goalId}/edit`);
    await expect(goalForm(page).locator(`input[name="DATA_SERIES_TYPE"][value="SUGGESTED"]`)).toBeChecked({ timeout: 30_000 });
    await expect(visible(page, "#select-preset")).not.toHaveValue("");
    await waitForRecipeFormSyncs(page);
    expect(await recipeFormErrors(page)).toEqual([]);
  });

  test("a custom equation subtracting a series from itself stores zeros", async ({ page, admin, workspace }) => {
    await openFormAndPick(page, workspace, () => addSeriesVariable(page, workspace, "a"));
    // eslint-disable-next-line no-template-curly-in-string -- a recipe equation, not a JS template
    await goalForm(page).getByPlaceholder("copy_and_scale.custom_recipe_placeholder").fill("${a} - ${a}");
    await visible(page, "#goalName").fill(`Zero ${workspace.label}`);

    await waitForRecipeFormSyncs(page);
    expect(await recipeFormErrors(page)).toEqual([]);
    // The preview shows the evaluated series: zero for every year the parent covers
    const preview = goalForm(page).getByText("copy_and_scale.resulting_data_series").locator("xpath=following-sibling::div[1]");
    await expect(preview).toContainText("0.0");

    const goalId = await submitNewGoal(page);
    await expect(page).toHaveURL(`/goal/${goalId}`, { timeout: 30_000 });
    const goal = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, entity => seriesValues(entity?.data_series).length > 0);
    expect(seriesValues(goal?.data_series).slice(0, parentValues.length)).toEqual([0, 0, 0]);
  });

  test("an equation error is reported by the form and blocks the submit", async ({ page, workspace }) => {
    await openFormAndPick(page, workspace, () => addSeriesVariable(page, workspace, "a"));
    // eslint-disable-next-line no-template-curly-in-string -- a recipe equation, not a JS template
    await goalForm(page).getByPlaceholder("copy_and_scale.custom_recipe_placeholder").fill("${a} * ${missing}");
    await visible(page, "#goalName").fill(`Broken ${workspace.label}`);

    await waitForRecipeFormSyncs(page);
    const errors = await recipeFormErrors(page);
    // `missing` names no variable, so the equation can't be parsed
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/equation/i);

    await expectSubmitBlocked(page, "goal.errors.recipe_has_error");

    // Fixing the equation clears the error
    // eslint-disable-next-line no-template-curly-in-string -- a recipe equation, not a JS template
    await goalForm(page).getByPlaceholder("copy_and_scale.custom_recipe_placeholder").fill("${a} * 2");
    await waitForRecipeFormSyncs(page);
    expect(await recipeFormErrors(page)).toEqual([]);
  });

  test("an unfinished external history selection blocks the submit", async ({ page, workspace }) => {
    await mockStemApi(page);
    await page.goto(createUrl(workspace));

    const form = goalForm(page);
    await form.locator('input[name="DATA_SERIES_TYPE"][value="MANUAL"]').check();
    await visible(page, "#indicatorParameter").fill(`Recipe\\${workspace.label}\\External`);
    await visible(page, "#goal-manual-unit").fill("ton");
    await visible(page, "#goal-manual-unit").blur();
    // The shared helper focuses the grid first; Firefox otherwise swallows the first fill as a focus change
    await fillManualDataSeries(page, [[2020, 5]]);

    // History from STEM: the table is chosen, but the required period and region are not
    await page.getByTestId("historical-section-toggle").filter({ visible: true }).click();
    await visible(page, 'input[name="historical-data-type"][value="EXTERNAL"]').check();
    await visible(page, "#externalDataset").selectOption("STEM");
    await pickSingleSearchOption(page, "externalTableId", "Nätanslutna solcellsanläggningar");
    await expect(goalForm(page).locator('p[role="status"]')).toContainText("query_builder.selection_incomplete");

    await waitForRecipeFormSyncs(page);
    await expectSubmitBlocked(page, "goal.errors.missing_historical_data");
  });
});
