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

/** What the browser did with a submit click, read off the form after the fact (see `submitForm`) */
type SubmitProbe = { submits: number, invalid: string[], valid: boolean, active: string | null };

/**
 * Clicks the visible `#submit-button` and resolves with the status of the
 * `method` request to `apiPath` it triggers.
 *
 * WebKit on a loaded CI runner has swallowed the click of a re-shown form: the
 * button took focus but no submit event followed, no validation bubble, no
 * request. The submit handlers wait for the recipe syncs (up to 5 s) before
 * fetching, so a request is expected within seconds of a real submit; when
 * none shows up the click is repeated once, and the probe attached to the form
 * says whether the first click submitted at all or constraint validation
 * blocked it. A submit that merely was slow is never repeated (it would
 * double-save and 409).
 */
export async function submitForm(page: Page, apiPath: string, method: "POST" | "PUT" | "DELETE" = "PUT"): Promise<number> {
  const matches = (url: string, requestMethod: string) => new URL(url).pathname === apiPath && requestMethod === method;
  const button = visible(page, "#submit-button");
  await button.evaluate((element) => {
    const form = element.closest("form");
    if (!form) throw new Error("submit button outside a form");
    const probe = { submits: 0, invalid: [] as string[] };
    form.addEventListener("submit", () => { probe.submits++; }, { capture: true });
    form.addEventListener("invalid", (event) => { probe.invalid.push((event.target as HTMLElement | null)?.outerHTML.slice(0, 120) ?? "?"); }, { capture: true });
    (window as unknown as { __submitProbe: typeof probe }).__submitProbe = probe;
  });
  const readProbe = () => button.evaluate((element): SubmitProbe => {
    const form = element.closest("form");
    const probe = (window as unknown as { __submitProbe?: { submits: number, invalid: string[] } }).__submitProbe ?? { submits: -1, invalid: [] };
    return { ...probe, valid: form?.checkValidity() ?? false, active: document.activeElement?.outerHTML.slice(0, 120) ?? null };
  });

  const response = page.waitForResponse((res) => matches(res.url(), res.request().method()), { timeout: 30_000 });
  const sent = page.waitForRequest((req) => matches(req.url(), req.method()), { timeout: 8_000 }).then(() => true, () => false);
  await button.click();
  if (!(await sent)) {
    const probe = await readProbe();
    console.warn(`submit click produced no ${method} ${apiPath} request within 8s; retrying once. Probe: ${JSON.stringify(probe)}`);
    expect(probe.submits, "the first click submitted after all, not retrying").toBe(0);
    await button.click();
  }
  return (await response).status();
}

/** The goal edit form is ready once its manual series rows have hydrated from the goal (first year `firstYear`) */
export async function expectGoalEditFormReady(page: Page, firstYear = "2020") {
  await expect(visible(page, "#goalName")).toBeVisible({ timeout: 30_000 });
  await expect(visible(page, `#goal-dataseries [data-row="0"][data-column="1"] input`)).toHaveValue(firstYear, { timeout: 30_000 });
}

/**
 * Picks an option in a SelectSingleSearch combobox (`#<id>`) by searching for
 * it first: the listbox is `#<id>-dialog-listbox` and lists every option, so
 * narrowing by the search box keeps the click unambiguous.
 */
export async function pickSingleSearchOption(page: Page, comboboxId: string, option: string) {
  await visible(page, `#${comboboxId}`).click();
  const dialog = visible(page, `#${comboboxId}-dialog`);
  await dialog.locator('input[type="text"]').fill(option);
  await dialog.locator(`#${comboboxId}-dialog-listbox li`).filter({ hasText: option }).first().click();
}

/**
 * Deletes the page's object through its admin panel: opens the confirm dialog,
 * types the object's name and submits. Resolves with the API's answer to the
 * DELETE request against `apiUrl` (e.g. `/api/goal`).
 */
export async function confirmDelete(page: Page, targetName: string, apiUrl: string) {
  await page.locator("aside menu button").filter({ visible: true }).filter({ hasText: "table_menu.delete" }).click();
  const dialog = page.locator("dialog[open]").filter({ has: page.locator('input[id^="delete-name-input-"]') });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[id^="delete-name-input-"]').fill(targetName);
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url().includes(apiUrl) && response.request().method() === "DELETE"),
    dialog.locator('button[type="submit"]').click(),
  ]);
  return response;
}

/**
 * Rewrites the goal form's manual grid in place: adds rows only beyond the
 * ones already there (the edit form starts with the stored series), so no
 * empty rows are left behind to be rejected on submit.
 */
export async function rewriteManualDataSeries(page: Page, rows: ReadonlyArray<readonly [number | string, number | string]>, gridId = "#goal-dataseries") {
  const grid = visible(page, gridId);
  const existing = await grid.locator('[data-column="1"] input').count();
  const addRow = page.getByTestId("add-row-button").filter({ visible: true });
  for (let i = existing; i < rows.length; i++) {
    await addRow.click();
  }
  await grid.locator('[data-row="0"][data-column="1"] input').focus();
  for (let row = 0; row < rows.length; row++) {
    const [year, value] = rows[row];
    await grid.locator(`[data-row="${row}"][data-column="1"] input`).fill(String(year));
    await grid.locator(`[data-row="${row}"][data-column="2"] input`).fill(String(value));
  }
}

/**
 * Loads `url` until `check` passes. On the dev server the first render after a
 * create/update can still be the cached one even though the API expires its
 * tags immediately (`revalidateTag(tag, { expire: 0 })`), so a page reached
 * right after a write is retried instead of asserted once.
 */
export async function gotoUntil(page: Page, url: string, check: () => Promise<void>, timeout = 45_000) {
  await expect(async () => {
    await page.goto(url);
    await check();
  }).toPass({ timeout, intervals: [1_000, 2_000, 5_000] });
}

/**
 * Opens `/goal/create` and picks the version of `roadmapName` as the parent.
 * A roadmap created moments before can be missing from the first (cached)
 * render of the form's roadmap list, so the page is reloaded until it is there.
 */
export async function openGoalCreateIn(page: Page, roadmapName: string | RegExp, url = "/goal/create") {
  const option = visible(page, "#parent-roadmap-dialog-listbox li").filter({ hasText: roadmapName }).first();
  await gotoUntil(page, url, async () => {
    // A click before hydration opens nothing; click until the listbox is there
    await expect(async () => {
      await visible(page, "#parent-roadmap").click({ timeout: 5_000 });
      await expect(visible(page, "#parent-roadmap-dialog-listbox li").first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    // Narrow the long list so the option isn't scrolled under the fields below the combobox
    if (typeof roadmapName === "string") await visible(page, "#parent-roadmap-dialog input").fill(roadmapName);
    await expect(option).toBeVisible({ timeout: 5_000 });
  }, 120_000);
  await option.click();
}

/**
 * Opens a SelectSingleTree combobox, waits until its roadmap data has loaded
 * (it fetches every readable roadmap version and each one's goals, which takes
 * close to a minute on the seeded DB under load) and closes it again, so that
 * `pickTreeSeries` only has to wait for its own roadmap.
 */
export async function waitForTreeLoaded(page: Page, combobox: Locator, timeout = 150_000) {
  const id = await combobox.getAttribute("id");
  if (!id) throw new Error("Tree combobox has no id");
  const tree = visible(page, `#${id}-dialog-tree`);
  // A click before hydration opens nothing; click until the tree is shown
  await expect(async () => {
    if ((await combobox.getAttribute("aria-expanded")) !== "true") await combobox.click({ timeout: 5_000 });
    await expect(tree.locator("> li").first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  // The loading / no-results rows are presentation rows; real nodes are tree items
  await expect(tree.locator('> li:not([role="presentation"])').first()).toBeVisible({ timeout });
  await page.keyboard.press("Escape");
  await expect(combobox).toHaveAttribute("aria-expanded", "false");
}

/**
 * Runs `check` against the current page, reloading between attempts until it passes.
 * For what a page shows right after a write: on the dev server the first render after
 * an update can still be the cached one (an immediate `revalidateTag(..., { expire: 0 })`
 * behaves like stale-while-revalidate for one read), and deletes revalidate with `max` by
 * design. Give `check` short expect timeouts; a page that never catches up still fails.
 */
export async function reloadUntil(page: Page, check: () => Promise<void>, timeout = 30_000) {
  let attempt = 0;
  await expect(async () => {
    if (attempt++ > 0) await page.reload();
    await check();
  }).toPass({ timeout });
}

/**
 * The goal form's joined indicator parameter ("A\B\C"). The input is one box per
 * path segment (`indicator-segment-<n>`, the first one is `#indicatorParameter`);
 * filling the first box with a full path replaces the whole path, but reading it
 * back has to go through this hidden joined value.
 */
export function indicatorValue(page: Page): Locator {
  return visible(page, 'form[name="goalForm"]').getByTestId("indicator-parameter-value");
}
