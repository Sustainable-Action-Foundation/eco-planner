import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { expect, test } from "../lib/fixtures";
import { createAction, createGoal, createIteration } from "../lib/api";
import { confirmDelete, fillManualDataSeries, gridCellValue, openCreate, pickIterationInActionForm, pickSingleSearchOption, recordDialogs, reloadUntil, rewriteManualDataSeries, submitForm, visible } from "../lib/forms";
import { iterationPath } from "../../src/functions/versionSlug";

/*
 * An action's life in a throwaway roadmap: created through the form with
 * free-form descriptive fields (whose entry order is the persisted order), from
 * the roadmap's admin panel, linked to an origin action and unlinked again,
 * tied to a goal through effects (the goal page keeps its own actions apart
 * from effects coming from other versions), and deleted through the admin panel.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/** The repeatable descriptive-field rows of the visible action form: one <details> accordion per group */
function actionFieldRows(page: Page) {
  return page.getByTestId("action-field-row").filter({ visible: true });
}

/** The rows are collapsed <details>; open them all so their inputs become visible and fillable */
async function openActionFieldRows(page: Page) {
  await actionFieldRows(page).evaluateAll(rows => rows.forEach(row => row.setAttribute("open", "")));
}

/** The headers of the visible form's field rows, in DOM order */
async function actionFieldHeaders(page: Page): Promise<string[]> {
  return actionFieldRows(page).getByTestId("action-field-header").evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
}

/**
 * Adds a descriptive-field row with the given header and first value, optionally
 * of a non-paragraph type (`action.field_types.<type>` radios), and resolves
 * with the row's index. New actions start with no rows.
 */
async function addActionField(page: Page, header: string, value: string, type: "paragraph" | "short" | "date" = "paragraph"): Promise<number> {
  const index = await actionFieldRows(page).count();
  await visible(page, "form").getByRole("button", { name: "data_series_input.add_new_row" }).click();
  await expect(actionFieldRows(page)).toHaveCount(index + 1);
  await openActionFieldRows(page);
  const row = actionFieldRows(page).nth(index);
  await row.getByTestId("action-field-header").fill(header);
  if (type !== "paragraph") {
    await row.getByRole("radio", { name: `action.field_types.${type}` }).check();
  }
  await row.getByTestId("action-field-value").first().fill(value);
  return index;
}

/**
 * Picks the sandbox version in the action form's version select. The form's option list is
 * cached, and the sandbox was created moments ago, so the first render may predate it.
 */
async function pickSandboxInActionForm(page: Page, label: string) {
  const option = visible(page, "#iterationId").locator("option").filter({ hasText: `Sandbox ${label}` });
  await reloadUntil(page, () => expect(option).not.toHaveCount(0, { timeout: 5_000 }));
  await pickIterationInActionForm(page, `Sandbox ${label}`);
}

/** Fills the action form's name and submits it; resolves once the new action's page shows its heading */
async function submitNewAction(page: Page, name: string): Promise<string> {
  expect(await submitForm(page, "/api/action", "POST")).toBe(201);
  await page.waitForURL(/\/action\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 20_000 });
  return page.url().split("/action/")[1];
}

test.describe("Action lifecycle", () => {
  test.use({ storageState: adminFile });

  test("Create with descriptive fields: entry order is shown on the page and in the edit form", async ({ page, sandbox }) => {
    test.slow();
    const name = `Action fields ${sandbox.label}`;
    const dialogs = recordDialogs(page);

    await page.goto("/");
    await openCreate(page, "action");
    await page.waitForURL(/\/action\/create/);
    await pickSandboxInActionForm(page, sandbox.label);
    await visible(page, "#actionName").fill(name);
    await visible(page, "#action-description").fill("Described in the dedicated description input.");
    await visible(page, "#startYear").fill("2030");
    await visible(page, "#endYear").fill("2050");

    // Three groups in this entry order, one of each type; the short one becomes a list
    await addActionField(page, "Intro", "Paragraph text about the action.");
    await addActionField(page, "Deadline", "2031-06-30", "date");
    const actorsRow = await addActionField(page, "Actors", "Actor B", "short");
    await actionFieldRows(page).nth(actorsRow).getByRole("button", { name: "action.add_list_item" }).click();
    await actionFieldRows(page).nth(actorsRow).getByTestId("action-field-value").nth(1).fill("Actor A");

    const actionId = await submitNewAction(page, name);

    // The page lists the groups in entry order and the actors as a list in entry order (B before A)
    const main = visible(page, "main");
    await expect(main).toContainText("Described in the dedicated description input.");
    await expect(main).toContainText("2030 - 2050");
    const mainText = (await main.textContent())?.replace(/\s+/g, " ") ?? "";
    const intro = mainText.indexOf("Intro");
    const deadline = mainText.indexOf("Deadline");
    const actors = mainText.indexOf("Actors");
    expect(intro).toBeGreaterThan(-1);
    expect(deadline).toBeGreaterThan(intro);
    expect(actors).toBeGreaterThan(deadline);
    await expect(main).toContainText("2031-06-30");
    const listItems = await main.locator("ul li").allTextContents();
    expect(listItems.indexOf("Actor B")).toBeGreaterThan(-1);
    expect(listItems.indexOf("Actor B")).toBeLessThan(listItems.indexOf("Actor A"));

    // The edit form round-trips the same order, types and values
    await page.getByTestId("admin-panel-edit").filter({ visible: true }).click();
    await page.waitForURL(new RegExp(`/action/${actionId}/edit$`));
    await expect(visible(page, "#actionName")).toHaveValue(name);
    await expect(visible(page, "#action-description")).toHaveValue("Described in the dedicated description input.");
    await expect(visible(page, "#startYear")).toHaveValue("2030");
    await expect(visible(page, "#endYear")).toHaveValue("2050");
    await expect(actionFieldRows(page)).toHaveCount(3);
    expect(await actionFieldHeaders(page)).toEqual(["Intro", "Deadline", "Actors"]);
    await openActionFieldRows(page);
    await expect(actionFieldRows(page).nth(0).getByRole("radio", { name: "action.field_types.paragraph" })).toBeChecked();
    await expect(actionFieldRows(page).nth(1).getByRole("radio", { name: "action.field_types.date" })).toBeChecked();
    await expect(actionFieldRows(page).nth(1).getByTestId("action-field-value")).toHaveValue("2031-06-30");
    await expect(actionFieldRows(page).nth(2).getByRole("radio", { name: "action.field_types.short" })).toBeChecked();
    const actorValues = await actionFieldRows(page).nth(2).getByTestId("action-field-value").evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
    expect(actorValues).toEqual(["Actor B", "Actor A"]);

    // Saving the untouched form keeps everything
    expect(await submitForm(page, "/api/action", "PUT")).toBe(200);
    await page.waitForURL(new RegExp(`/action/${actionId}$`), { timeout: 30_000 });
    await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 20_000 });
    await expect(visible(page, "main")).toContainText("2031-06-30");
    expect(dialogs).toEqual([]);
  });

  test("Create from the roadmap version's admin panel", async ({ page, sandbox }) => {
    test.slow();
    const name = `Action from panel ${sandbox.label}`;

    await page.goto(iterationPath(sandbox.roadmapId, 1));
    await page.getByTestId("admin-panel-new-action").filter({ visible: true }).click();
    await page.waitForURL(/\/action\/create\?/);
    // The version is preselected by the link, so the form offers no picker
    await expect(visible(page, "#actionName")).toBeVisible();
    await expect(visible(page, "#iterationId")).toHaveCount(0);
    await visible(page, "#actionName").fill(name);
    await submitNewAction(page, name);

    // Listed on the version page it was created from
    await page.goto(iterationPath(sandbox.roadmapId, 1));
    await reloadUntil(page, () => expect(visible(page, "main").getByRole("link", { name })).toBeVisible({ timeout: 15_000 }), 90_000);
  });

  test("Origin link: neighbours on both sides, unlink removes them", async ({ page, admin, sandbox }) => {
    test.slow();
    const originName = `Origin ${sandbox.label}`;
    const copyName = `Copy ${sandbox.label}`;
    const originId = await createAction(admin, sandbox.iterationId, { name: originName });

    // Nothing links to the origin yet
    await page.goto(`/action/${originId}`);
    await expect(visible(page, "h1").filter({ hasText: originName })).toBeVisible();
    await expect(page.getByTestId("action-neighbours")).toHaveCount(0);

    // A copy linked through the origin picker (options read "<org> (<roadmap>): <name>")
    await page.goto("/action/create");
    await pickSandboxInActionForm(page, sandbox.label);
    await visible(page, "#actionName").fill(copyName);
    await pickSingleSearchOption(page, "origin-action", originName);
    const copyId = await submitNewAction(page, copyName);

    // The neighbours come from the cached action list, which may predate the copy for one render
    const neighbours = page.getByTestId("action-neighbours").filter({ visible: true });
    await reloadUntil(page, () => expect(neighbours.getByText("action.neighbour_origin_badge")).toBeVisible({ timeout: 10_000 }), 60_000);
    // The names differ, so the copy already counts as drifted from its origin
    await expect(neighbours.getByTestId("action-neighbour-differs")).toHaveCount(1);
    await expect(neighbours.getByRole("link", { name: originName })).toBeVisible();

    // The origin lists the copy, without an origin badge of its own (its page was rendered before the link)
    await page.goto(`/action/${originId}`);
    await reloadUntil(page, () => expect(neighbours.getByRole("link", { name: copyName })).toBeVisible({ timeout: 10_000 }), 60_000);
    await expect(neighbours.getByRole("link", { name: copyName })).toBeVisible();
    await expect(neighbours.getByText("action.neighbour_origin_badge")).toHaveCount(0);

    // Unlinking from the copy's edit form clears the section on both pages
    await page.goto(`/action/${copyId}/edit`);
    await visible(page, "form").getByRole("button", { name: "action.origin_unlink" }).click();
    expect(await submitForm(page, "/api/action", "PUT")).toBe(200);
    await page.waitForURL(new RegExp(`/action/${copyId}$`), { timeout: 30_000 });
    await reloadUntil(page, async () => {
      await expect(visible(page, "h1").filter({ hasText: copyName })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("action-neighbours")).toHaveCount(0, { timeout: 2_000 });
    });

    await page.goto(`/action/${originId}`);
    await reloadUntil(page, async () => {
      await expect(visible(page, "h1").filter({ hasText: originName })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("action-neighbours")).toHaveCount(0, { timeout: 2_000 });
    });
  });

  test("Goal page separates own actions from foreign effects; the effect can be edited", async ({ page, admin, sandbox }) => {
    test.slow();
    const iteration2 = await createIteration(admin, sandbox.roadmapId);
    const goalName = `Goal ${sandbox.label}`;
    const goalId = await createGoal(admin, iteration2, { name: goalName });
    const ownActionName = `Own action ${sandbox.label}`;
    const foreignActionName = `Foreign action ${sandbox.label}`;
    const goalUrl = `/goal/${goalId}`;

    const ownRows = page.getByTestId("goal-action-row").filter({ visible: true });
    const foreignRows = page.getByTestId("goal-foreign-effect-row").filter({ visible: true });

    // A fresh goal: both lists are empty, each section has its own button
    await page.goto(goalUrl);
    await expect(visible(page, "h1").filter({ hasText: goalName })).toBeVisible({ timeout: 20_000 });
    await expect(ownRows).toHaveCount(0);
    await expect(foreignRows).toHaveCount(0);

    // "Add action" creates an action in the goal's own version with its expected effect on this goal
    await page.getByTestId("goal-add-action").filter({ visible: true }).click();
    await page.waitForURL(/\/action\/create\?/);
    await visible(page, "#actionName").fill(ownActionName);
    await visible(page, "#startYear").fill("2030");
    await visible(page, "#endYear").fill("2050");
    await fillManualDataSeries(page, [[2030, 5]], "#action-dataseries");
    // The action form reads the effect series from its FormSync input at submit; wait for the typed values to land there
    await expect(visible(page, "form").locator('input[name="RESULTING_DATE_VALUES"]')).toHaveValue(/2030/);
    await submitNewAction(page, ownActionName);

    // Back on the goal page (rendered before the action existed) the action is a collapsed row in the own-actions list
    await page.goto(goalUrl);
    await reloadUntil(page, () => expect(ownRows).toHaveCount(1, { timeout: 5_000 }));
    await expect(foreignRows).toHaveCount(0);
    await expect(ownRows).toContainText(ownActionName);
    await expect(ownRows.getByText("goal_actions.impact_type")).not.toBeVisible();
    await ownRows.locator("summary").click();
    await expect(ownRows.getByText("goal_actions.impact_type")).toBeVisible();
    await expect(ownRows).toContainText("2030");
    await expect(ownRows.getByRole("link", { name: "goal_actions.view_action" })).toBeVisible();

    // An action in another version (v1), linked through "link effect", lands in the foreign list
    const foreignActionId = await createAction(admin, sandbox.iterationId, { name: foreignActionName });
    await page.getByTestId("goal-link-effect").filter({ visible: true }).click();
    await page.waitForURL(/\/effect\/create\?/);
    const roadmapSelect = visible(page, 'select[name="selectedActionRoadmap"]');
    const actionSelect = visible(page, "#actionId");
    // The pickers' option lists are cached; the foreign action is only moments old
    await reloadUntil(page, async () => {
      const roadmapOption = await roadmapSelect.locator("option").filter({ hasText: `Sandbox ${sandbox.label} (v1)` }).getAttribute("value", { timeout: 5_000 });
      expect(roadmapOption).toBeTruthy();
      await roadmapSelect.selectOption(roadmapOption ?? "");
      // Options read "<name>; <effect count>", loaded by a server action once the version is picked
      await expect(actionSelect.locator(`option[value="${foreignActionId}"]`)).toContainText(foreignActionName, { timeout: 10_000 });
    }, 60_000);
    await actionSelect.selectOption(foreignActionId);
    await fillManualDataSeries(page, [[2035, 2]], "#effect-dataseries");
    await expect(visible(page, "form").locator('input[name="RESULTING_DATE_VALUES"]')).toHaveValue(/2035/);
    expect(await submitForm(page, "/api/effect", "POST")).toBe(201);
    await page.waitForURL(url => !url.pathname.includes("/effect/create"), { timeout: 20_000 });

    await page.goto(goalUrl);
    await reloadUntil(page, () => expect(foreignRows).toHaveCount(1, { timeout: 5_000 }));
    await expect(ownRows).toHaveCount(1);
    await expect(foreignRows).toContainText(foreignActionName);
    await foreignRows.locator("summary").click();
    await expect(foreignRows).toContainText("effect.impact_types.absolute");
    await expect(foreignRows).toContainText("2035");

    // Editing the effect: the form starts from the saved series, and the change shows on the goal page
    await page.goto(`/effect/${foreignActionId}/${goalId}/edit`);
    // The action and goal selects fill their options client-side; until then the required goal select vetoes a submit
    await expect(visible(page, "#actionId")).toHaveValue(foreignActionId);
    await expect(visible(page, "#goalId")).toHaveValue(goalId);
    await expect(visible(page, "#impactType")).toHaveValue("ABSOLUTE");
    expect(await gridCellValue(page, 0, 1, "#effect-dataseries")).toBe("2035");
    expect(await gridCellValue(page, 0, 2, "#effect-dataseries")).toBe("2");
    await visible(page, "#impactType").selectOption("DELTA");
    // Rewrite through the shared helper: it focuses the grid first, without which Firefox treats the first fill as a focus change
    await rewriteManualDataSeries(page, [[2035, 7]], "#effect-dataseries");
    await expect(visible(page, "form").locator('input[name="RESULTING_DATE_VALUES"]')).toHaveValue(/:7[,}]/);
    expect(await submitForm(page, "/api/effect", "PUT")).toBe(200);
    await page.waitForURL(url => !url.pathname.endsWith("/edit"), { timeout: 20_000 });

    await page.goto(goalUrl);
    await reloadUntil(page, async () => {
      await expect(foreignRows).toHaveCount(1, { timeout: 5_000 });
      await foreignRows.locator("summary").click();
      await expect(foreignRows).toContainText("effect.impact_types.delta", { timeout: 2_000 });
    });
    await expect(foreignRows).toContainText("7.0");
  });

  test("Delete through the admin panel", async ({ page, admin, sandbox }) => {
    test.slow();
    const name = `Doomed action ${sandbox.label}`;
    const actionId = await createAction(admin, sandbox.iterationId, { name });
    const dialogs = recordDialogs(page);

    // Listed on its version page first, so the absence afterwards means something
    const versionPage = iterationPath(sandbox.roadmapId, 1);
    const listed = visible(page, "main").getByRole("link", { name });
    await page.goto(versionPage);
    await reloadUntil(page, () => expect(listed).toBeVisible({ timeout: 5_000 }));

    await page.goto(`/action/${actionId}`);
    await expect(visible(page, "h1").filter({ hasText: name })).toBeVisible({ timeout: 20_000 });
    const deleted = await confirmDelete(page, name, "/api/action");
    expect(deleted.status()).toBe(200);
    // The API sends the deleter back to the action's roadmap version, which no longer lists it.
    // Deletes revalidate with `max` on this branch (expired immediately on dev since 6814ef76),
    // so the first renders may still be the cached list.
    await page.waitForURL(new RegExp(`${versionPage}$`), { timeout: 20_000 });
    await reloadUntil(page, () => expect(listed).toHaveCount(0, { timeout: 2_000 }), 45_000);
    expect(dialogs).toEqual([]);
  });
});
