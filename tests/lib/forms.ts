import { expect } from "playwright/test";
import type { Locator, Page } from "playwright/test";

/*
 * Form helpers shared by the e2e specs. Hidden Activity routes stay mounted
 * (cacheComponents), so every locator here is scoped to visible elements.
 */

/** The visible instance of a selector (hidden Activity copies of a form share its ids) */
export function visible(page: Page, selector: string): Locator {
  return page.locator(selector).filter({ visible: true });
}

/** Opens the sidebar create menu and follows one of its entries (`create-goal`, `create-action`, `create-roadmap`) */
export async function openCreate(page: Page, entry: "goal" | "action" | "roadmap" | "effect") {
  await page.getByTestId("create-button").filter({ visible: true }).click();
  await page.getByTestId(`create-${entry}`).filter({ visible: true }).click();
}

/**
 * Types year/value rows into the goal form's manual data-series grid.
 * The first cell is focused up front: without it Firefox and WebKit swallow the
 * first fill as a focus change and leave the cell empty.
 */
export async function fillManualDataSeries(page: Page, rows: ReadonlyArray<readonly [number | string, number | string]>, gridId = "#goal-dataseries") {
  const grid = visible(page, gridId);
  const addRow = page.getByTestId("add-row-button").filter({ visible: true });
  for (let i = 1; i < rows.length; i++) {
    await addRow.click();
  }
  await grid.locator('[data-row="0"][data-column="1"] input').focus();
  for (let row = 0; row < rows.length; row++) {
    const [year, value] = rows[row];
    await grid.locator(`[data-row="${row}"][data-column="1"] input`).fill(String(year));
    await grid.locator(`[data-row="${row}"][data-column="2"] input`).fill(String(value));
  }
}

/** The stored value of a grid cell (year column 1, value column 2) */
export async function gridCellValue(page: Page, row: number, column: 1 | 2, gridId = "#goal-dataseries"): Promise<string> {
  return visible(page, gridId).locator(`[data-row="${row}"][data-column="${column}"] input`).inputValue();
}

/** Switches a roadmap version page's goal list to table view (the tree view hides leaves under collapsed branches) */
export async function useTableView(page: Page) {
  await visible(page, 'input[name="table"][value="TABLE"]').first().check();
  await expect(visible(page, "#goalTable")).toBeVisible();
}

/**
 * Picks a roadmap version in the goal form's parent-roadmap combobox by the
 * text of its option (a roadmap name, optionally with the version), e.g.
 * `pickIterationInGoalForm(page, /Sandbox abc/)`.
 */
export async function pickIterationInGoalForm(page: Page, option: string | RegExp) {
  await visible(page, "#parent-roadmap").click();
  await visible(page, "#parent-roadmap-dialog-listbox li").filter({ hasText: option }).first().click();
}

/** Picks a roadmap version in the action form's `#iterationId` select by option text */
export async function pickIterationInActionForm(page: Page, option: string | RegExp) {
  const select = visible(page, "#iterationId");
  const value = await select.locator("option").filter({ hasText: option }).first().getAttribute("value");
  expect(value, `iteration option ${String(option)}`).toBeTruthy();
  await select.selectOption(value ?? "");
}

/**
 * Drills a SelectSingleTree combobox roadmap → goal → data series and picks the
 * first leaf under `roadmapName` (the first goal's series), then closes it.
 * The tree lists every readable roadmap version, including the huge seeded LEAP
 * scenarios, so always drill into a small known roadmap.
 */
export async function pickTreeSeries(page: Page, combobox: Locator, roadmapName: string | RegExp, goalName?: string | RegExp) {
  await combobox.click();
  const id = await combobox.getAttribute("id");
  if (!id) throw new Error("Tree combobox has no id");
  const tree = visible(page, `#${id}-dialog-tree`);
  const roadmap = tree.locator("> li").filter({ hasText: roadmapName }).first();
  await expect(roadmap).toBeVisible({ timeout: 30_000 });
  await roadmap.click();
  const goal = goalName ? roadmap.locator("> ul > li").filter({ hasText: goalName }).first() : roadmap.locator("> ul > li").first();
  await goal.click();
  await goal.locator("> ul > li").first().click();
  await page.keyboard.press("Escape");
}

/**
 * Waits until every recipe section of the visible goal form has finished its
 * debounced evaluation (`RECIPE_EVALUATION_PENDING` inputs all read "false").
 */
export async function waitForRecipeFormSyncs(page: Page, form = 'form[name="goalForm"]') {
  await expect.poll(
    () => page.locator(`${form} input[name="RECIPE_EVALUATION_PENDING"]:enabled`).evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)),
    { timeout: 30_000 },
  ).not.toContain("true");
}

/** The recipe errors the visible goal form would submit, read from its `RECIPE_ERROR` inputs */
export async function recipeFormErrors(page: Page, form = 'form[name="goalForm"]'): Promise<string[]> {
  return page.locator(`${form} input[name="RECIPE_ERROR"]:enabled`).evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value).filter(Boolean));
}

/** The visible goal page admin panel's edit entry (behind the edit menu) */
export async function openGoalEdit(page: Page) {
  await page.getByTestId("admin-panel-edit-menu").filter({ visible: true }).click();
  await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
}

/** Records every native dialog (the forms `alert()` their API rejections) and dismisses it */
export function recordDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on("dialog", (dialog) => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  return messages;
}
