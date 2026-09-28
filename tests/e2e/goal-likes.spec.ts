import { expect, test } from "playwright/test";
import type { Locator, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/*
 * Likes on goals: the goal page's like button toggles the user's like, and
 * the org landing lists the goals the org's members have liked, ranked by
 * likes. anita is a member of Sustainable Action only, so "/" is her org's
 * landing, and the seed leaves every goal unliked.
 */

/** Switches the goal list to table view; the default tree view hides leaves inside collapsed branches. */
async function useTableView(page: Page) {
  await page.locator('input[name="table"][value="TABLE"]').first().check();
  await expect(page.locator('#goalTable')).toBeVisible();
}

/** Opens Rikets färdplan v2 from the public landing. */
async function gotoNationalV2(page: Page) {
  await page.goto("/?org=public");
  const href = await page.getByRole("link", { name: /Rikets färdplan/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto((href ?? "").replace(/\/(v\d+|latest)\/?$/, "/v2"));
  await expect(page.getByTestId("show-roadmap")).toBeVisible();
}

/** The like button of the page or of a list row; hidden route copies stay mounted, so only the visible one counts. */
function likeButton(scope: Page | Locator) {
  return scope.getByTestId("goal-like-button").filter({ visible: true });
}

/** Clicks a like button and waits for the like to be saved, not just shown: the button is optimistic. */
async function toggleLike(page: Page, button: Locator) {
  await Promise.all([
    page.waitForResponse(response => response.url().includes("/api/goal-like") && response.ok()),
    button.click(),
  ]);
}

/** The landing's ranked row for the named goal. */
function likedRow(page: Page, name: string) {
  return page.getByTestId("liked-goal").filter({ visible: true }).filter({ has: page.locator('a[href^="/goal/"]', { hasText: name }) });
}

test.describe.serial("Goal likes", () => {
  test.use({ storageState: verifiedFile });

  let goalHref = "";
  let goalName = "";

  test.beforeAll(async ({ browser }) => {
    // Some listed goal on the public national roadmap: readable by everyone, so likeable
    const page = await browser.newPage({ storageState: verifiedFile });
    await gotoNationalV2(page);
    await useTableView(page);
    const link = page.locator('#goalTable a[href^="/goal/"]').first();
    goalHref = (await link.getAttribute("href")) ?? "";
    goalName = (await link.textContent())?.trim() ?? "";
    expect(goalHref).toBeTruthy();
    expect(goalName).toBeTruthy();
    await page.close();
  });

  test("Liking a goal counts it and lists it on the org landing", async ({ page }) => {
    await page.goto(goalHref);
    const button = likeButton(page);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    const before = Number(await button.getByTestId("goal-like-count").textContent());

    await toggleLike(page, button);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button.getByTestId("goal-like-count")).toHaveText(String(before + 1));

    // The like survives a reload: it is stored, not just local state
    await page.reload();
    await expect(likeButton(page)).toHaveAttribute("aria-pressed", "true");

    // Ranked on the org landing, with the org's like count
    await page.goto("/");
    const row = likedRow(page, goalName);
    await expect(row).toHaveCount(1);
    await expect(likeButton(row)).toHaveAttribute("aria-pressed", "true");
    await expect(likeButton(row).getByTestId("goal-like-count")).toHaveText("1");
    // Rikets färdplan belongs to anita's own org, so it isn't offered for copying
    await expect(row.locator('a[href^="/goal/create?from="]')).toHaveCount(0);
  });

  test("Unliking from the list drops the goal from it", async ({ page }) => {
    await page.goto("/");
    const row = likedRow(page, goalName);
    await expect(row).toHaveCount(1);

    await toggleLike(page, likeButton(row));
    // The list refreshes off the server after the toggle
    await expect(likedRow(page, goalName)).toHaveCount(0);
    await expect(page.getByTestId("liked-goals-empty").filter({ visible: true })).toBeVisible();

    await page.goto(goalHref);
    await expect(likeButton(page)).toHaveAttribute("aria-pressed", "false");
  });
});
