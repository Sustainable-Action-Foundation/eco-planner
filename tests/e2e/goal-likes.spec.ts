import { expect, test } from "playwright/test";
import type { Browser, BrowserContext, Locator, Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { orgLandingHref } from "../lib/org-switcher";
import { memberSlug } from "../../scripts/prisma/seed/places";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
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

/** A context signed in as a seeded place member (scripts/prisma/seed/places.ts): "First Last", password "password". */
async function memberContext(browser: Browser, name: string): Promise<BrowserContext> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const response = await context.request.post("/api/login", { data: { username: memberSlug(name), password: "password" } });
  expect(response.status(), `login of ${name}`).toBe(200);
  return context;
}

/** The link switching the landing's liked goals to a scope (a LikeScope value). */
function scopeLink(page: Page, scope: "ORG" | "AREA" | "COUNTY") {
  return page.getByTestId("liked-goals-scope").filter({ visible: true }).locator(`a[data-scope="${scope}"]`);
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
    // Other members' likes may keep the list populated; the empty state only replaces an empty list
    if (await page.getByTestId("liked-goal").filter({ visible: true }).count() === 0) {
      await expect(page.getByTestId("liked-goals-empty").filter({ visible: true })).toBeVisible();
    }

    await page.goto(goalHref);
    await expect(likeButton(page)).toHaveAttribute("aria-pressed", "false");
  });
});

/*
 * Boden and Kiruna are municipalities of Norrbottens län, each with an org of
 * its own in the seed (as has the region). A like from Kiruna is none of
 * Boden's business until Boden looks at the whole county.
 */
test.describe.serial("Area-wide likes", () => {
  let goalId = "";
  let goalName = "";
  let kiruna: BrowserContext;
  let boden: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    kiruna = await memberContext(browser, "Lars Niia");
    boden = await memberContext(browser, "Nils Forsberg");

    // Another goal than the one the tests above like and unlike
    const page = await kiruna.newPage();
    await gotoNationalV2(page);
    await useTableView(page);
    const link = page.locator('#goalTable a[href^="/goal/"]').nth(1);
    goalId = ((await link.getAttribute("href")) ?? "").split("/").pop() ?? "";
    goalName = (await link.textContent())?.trim() ?? "";
    expect(goalId).toBeTruthy();
    expect(goalName).toBeTruthy();
    await page.close();

    const liked = await kiruna.request.post("/api/goal-like", { data: { goalId } });
    expect(liked.status()).toBe(200);
  });

  test.afterAll(async () => {
    await kiruna.request.delete("/api/goal-like", { data: { goalId } });
    await kiruna.close();
    await boden.close();
  });

  test("A like from another municipality shows in the county's list only", async () => {
    const page = await boden.newPage();
    // A single-org member lands on their org
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toBeVisible();

    // Boden's own list, then all of Boden: Kiruna's like is in neither
    await expect(scopeLink(page, "ORG")).toHaveAttribute("aria-current", "true");
    await expect(likedRow(page, goalName)).toHaveCount(0);
    await scopeLink(page, "AREA").click();
    await expect(scopeLink(page, "AREA")).toHaveAttribute("aria-current", "true");
    await expect(page).toHaveURL(/likes=area/);
    await expect(likedRow(page, goalName)).toHaveCount(0);

    // The county gathers its municipalities
    await scopeLink(page, "COUNTY").click();
    await expect(scopeLink(page, "COUNTY")).toHaveAttribute("aria-current", "true");
    const row = likedRow(page, goalName);
    await expect(row).toHaveCount(1);
    await expect(likeButton(row).getByTestId("goal-like-count")).toHaveText("1");
    await expect(likeButton(row)).toHaveAttribute("aria-pressed", "false");
    await expect(row.getByTestId("liked-goal-org-count")).toBeVisible();

    // Liking it from Boden makes it two likes from two organizations, and puts it in Boden's own list
    await toggleLike(page, likeButton(row));
    await expect(likeButton(likedRow(page, goalName)).getByTestId("goal-like-count")).toHaveText("2");
    await scopeLink(page, "ORG").click();
    await expect(scopeLink(page, "ORG")).toHaveAttribute("aria-current", "true");
    await expect(likedRow(page, goalName)).toHaveCount(1);
    await toggleLike(page, likeButton(likedRow(page, goalName)));
    await expect(likedRow(page, goalName)).toHaveCount(0);
    await page.close();
  });
});

test.describe("Org area", () => {
  test.use({ storageState: adminFile });

  test("Managers see and set the org's area; unknown areas are refused", async ({ page }) => {
    await page.goto("/");
    const orgId = new URL(await orgLandingHref(page, "Kiruna kommun"), "http://localhost").searchParams.get("org") ?? "";
    expect(orgId).toBeTruthy();

    await page.goto(`/org/${orgId}/groups`);
    const form = page.getByTestId("org-area-form").filter({ visible: true });
    await expect(form).toContainText("Kiruna");
    // Nothing to save until the area changes
    await expect(form.getByTestId("org-area-save")).toBeDisabled();

    const unknown = await page.request.put("/api/org", { data: { orgId, geoAreaCode: "9999" } });
    expect(unknown.status()).toBe(400);
    // Kiruna's own code (SCB 2584): accepted, and leaves the seed as it was
    const same = await page.request.put("/api/org", { data: { orgId, geoAreaCode: "2584" } });
    expect(same.status()).toBe(200);
  });
});
