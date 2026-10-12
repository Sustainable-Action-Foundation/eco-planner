import path from "node:path";
import { cwd } from "node:process";
import type { Page } from "playwright/test";
import { createGoal, yearlyDateValues } from "../lib/api";
import { expect, test } from "../lib/fixtures";
import { gotoUntil, visible } from "../lib/forms";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/*
 * The goal page's own interactions on a goal of the sandbox roadmap: the graph
 * type switch and the comment thread.
 */

/** The y-axis tick labels of the visible goal graph, top to bottom */
function yAxisLabels(page: Page) {
  return visible(page, ".apexcharts-yaxis-label tspan");
}

/** The goal page has rendered once its comment box is there (its SSR is slow under load) */
async function gotoGoal(page: Page, goalId: string) {
  await page.goto(`/goal/${goalId}`);
  await expect(visible(page, "#comment-text")).toBeVisible({ timeout: 60_000 });
}

test.describe("Goal page", () => {
  test.use({ storageState: adminFile });
  test.beforeEach(() => test.slow());

  test("the graph switches between the goal, its annual change and its change in percent", async ({ page, admin, sandbox }) => {
    // 10 → 20 → 40: changes of 10 and 20, and 200 % / 400 % of the first value
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Graph ${sandbox.label}`, unit: "ton", dateValues: yearlyDateValues([10, 20, 40]) });
    await gotoGoal(page, goalId);

    const graphType = visible(page, "#select-graphType");
    await expect(graphType).toHaveValue("MAIN");
    await expect(visible(page, ".apexcharts-series")).toHaveCount(1, { timeout: 30_000 });
    await expect(yAxisLabels(page).first()).toHaveText("40");
    await expect(yAxisLabels(page).last()).toHaveText("10");

    await graphType.selectOption("DELTA");
    await expect(yAxisLabels(page).first()).toHaveText("20");
    await expect(yAxisLabels(page).last()).toHaveText("10");

    await graphType.selectOption("RELATIVE");
    await expect(yAxisLabels(page).first()).toHaveText("400");
    await expect(yAxisLabels(page).last()).toHaveText("100");

    // The choice is remembered for the goal
    await gotoGoal(page, goalId);
    await expect(visible(page, "#select-graphType")).toHaveValue("RELATIVE");
    await expect(yAxisLabels(page).first()).toHaveText("400", { timeout: 30_000 });

    await visible(page, "#select-graphType").selectOption("MAIN");
    await expect(yAxisLabels(page).first()).toHaveText("40");
  });

  test("a percentage goal is not offered the change in percent", async ({ page, admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Percent ${sandbox.label}`, unit: "procent", dateValues: yearlyDateValues([10, 20]) });
    await gotoGoal(page, goalId);
    const options = visible(page, "#select-graphType").locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.filter({ hasText: "graph_selector.percentage_change" })).toHaveCount(0);
  });

  test("a comment is posted, counted and a long one folds", async ({ page, admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Comments ${sandbox.label}` });
    await gotoGoal(page, goalId);
    await expect(visible(page, "h2").filter({ hasText: "comments.comment_count" })).toContainText('"count":0');

    const box = visible(page, "#comment-text");
    const send = visible(page, 'button[type="submit"]').filter({ hasText: "comments.send" });
    await expect(send).toBeDisabled();

    // Typing enables the buttons; cancel empties the box again
    await box.pressSequentially("draft");
    await expect(send).toBeEnabled();
    await visible(page, "button").filter({ hasText: "tsx.cancel" }).click();
    await expect(box).toHaveText("");
    await expect(send).toBeDisabled();

    const short = `Short ${sandbox.label}`;
    await box.pressSequentially(short);
    const [posted] = await Promise.all([
      page.waitForResponse(res => new URL(res.url()).pathname === "/api/comment" && res.request().method() === "POST"),
      send.click(),
    ]);
    // The form reloads the page on success, so only the status is still readable
    expect(posted.status()).toBe(200);
    await gotoUntil(page, `/goal/${goalId}`, async () => {
      await expect(visible(page, "p").filter({ hasText: short })).toBeVisible({ timeout: 5_000 });
    }, 90_000);
    await expect(visible(page, "h2").filter({ hasText: "comments.comment_count" })).toContainText('"count":1');

    // Longer than 300 characters: shown cut short until expanded (posted through the API, typing it is slow)
    const long = `Long ${sandbox.label} ${"x".repeat(320)} tail`;
    const response = await admin.post("/api/comment", { data: { commentText: long, objectId: goalId } });
    expect(response.status(), await response.text()).toBe(200);
    await gotoUntil(page, `/goal/${goalId}`, async () => {
      await expect(visible(page, "p").filter({ hasText: `Long ${sandbox.label}` })).toBeVisible({ timeout: 5_000 });
    }, 90_000);
    const longComment = visible(page, "p").filter({ hasText: `Long ${sandbox.label}` });
    await expect(longComment).not.toContainText("tail");
    await visible(page, "button").filter({ hasText: "tsx.show_more" }).click();
    await expect(longComment).toContainText("tail");
    await visible(page, "button").filter({ hasText: "tsx.show_less" }).click();
    await expect(longComment).not.toContainText("tail");
    await expect(visible(page, "h2").filter({ hasText: "comments.comment_count" })).toContainText('"count":2');
  });
});
