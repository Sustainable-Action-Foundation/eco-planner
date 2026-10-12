import path from "node:path";
import { cwd } from "node:process";
import type { APIRequestContext, Page } from "playwright/test";
import { seedPlaces } from "../../scripts/prisma/seed/places";
import areaCodes from "../../src/lib/areaCodes.json" with { type: "json" };
import { loginAs, loginContext, memberContext, publicGoalId, Seed } from "../lib/api";
import { expect, test } from "../lib/fixtures";
import { gotoUntil, openGoalCreateIn, visible, waitForRecipeFormSyncs } from "../lib/forms";
import { withLock } from "../lib/lock";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

/*
 * Copying a national goal into one's own roadmap from its page ("use in
 * roadmap"), the org landing marking the liked goals the org has copied, and
 * the goal page's preview of a national goal at the member's own area. Only
 * a goal the LEAP rules copy as is is used: every scaling method reads the
 * statistics APIs, which the app server calls and a browser test can't mock.
 */

/** A blend share: the LEAP rule copies it as is */
const leafAsIs = "andel låginblandad HVO";

const boden = seedPlaces.find(place => place.name === "Bodens kommun");
if (!boden?.roadmapName) throw new Error("The seed has no Boden roadmap");
/** Boden's geo area name, as the preview toggle names it */
const bodenArea = Object.entries(areaCodes).find(([, code]) => code === boden.geoCode)?.[0] ?? "";

function submitButton(page: Page) {
  return visible(page, "#submit-button");
}

/**
 * From the goal's page, follows "use in roadmap" to the prefilled goal form
 * and points it at the version of `roadmap`. Waits for the recipe sections to
 * settle (they remount for the roadmap's area): a submit before that would
 * be rejected for missing data instead.
 */
async function openCopyForm(page: Page, goalId: string, roadmap: string) {
  await page.goto(`/goal/${goalId}`);
  const useLink = visible(page, `a[href="/goal/create?from=${goalId}"]`).first();
  await expect(useLink).toBeVisible({ timeout: 30_000 });
  await useLink.click();
  // A client navigation: the URL changes once the (slow) form page has answered
  await expect(page).toHaveURL(`/goal/create?from=${goalId}`, { timeout: 90_000 });
  await openGoalCreateIn(page, roadmap, `/goal/create?from=${goalId}`);
  // Evaluating the prefilled method fetches the scenario's series through a server action, which can
  // take longer than `waitForRecipeFormSyncs` allows on a loaded server; give it room first
  await expect.poll(
    () => page.locator('form[name="goalForm"] input[name="RECIPE_EVALUATION_PENDING"]:enabled').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value)),
    { timeout: 120_000 },
  ).not.toContain("true");
  await waitForRecipeFormSyncs(page);
}

/** Submits the copy form and resolves with the goal API's answer */
async function submitCopy(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/goal" && response.request().method() === "POST", { timeout: 30_000 }),
    submitButton(page).click(),
  ]);
  return response;
}

/** A refused copy says why and hands the button back, without leaving the form */
async function expectRefusedCopy(page: Page) {
  const response = await submitCopy(page);
  expect(response.status(), await response.text()).toBe(409);
  // The toast carries the API's message, translated on the server, which names the existing copy
  await expect(page.getByTestId("toast-list").filter({ visible: true })).toContainText(leafAsIs);
  await expect(submitButton(page)).toBeEnabled();
  await expect(submitButton(page).locator("[data-pending]")).toHaveCount(0);
  await expect(page).toHaveURL(/\/goal\/create/);
}

/** Whether `request`'s user currently likes the goal, read off its like button on the goal page */
async function likedByViewer(request: APIRequestContext, goalId: string): Promise<boolean> {
  // The scenario's goal pages are slow to render; read the raw page with a generous timeout
  const response = await request.get(`/goal/${goalId}`, { timeout: 180_000 });
  expect(response.status()).toBe(200);
  const match = (await response.text()).match(new RegExp(`\\\\?"goalId\\\\?":\\\\?"${goalId}\\\\?",\\\\?"liked\\\\?":(true|false)`));
  expect(match, "the goal page's like button").toBeTruthy();
  return match?.[1] === "true";
}

test.describe("Copying a goal into a roadmap", () => {
  test.describe.configure({ mode: "serial" });
  // The LEAP goal page and the copy form are heavy on the seeded DB
  test.beforeEach(() => test.slow());

  let goalId = "";

  test.beforeAll(async ({ playwright, baseURL }) => {
    // The scenario's version page is slow to render on the seeded DB
    test.setTimeout(600_000);
    const admin = await playwright.request.newContext({ baseURL });
    await loginAs(admin, Seed.admin.username, Seed.admin.password);
    goalId = await publicGoalId(admin, Seed.leapScenario, leafAsIs);
    await admin.dispose();
  });

  test("a copy the roadmap already has is refused with a message and the button comes back", async ({ browser }) => {
    // The seed copies every LEAP goal into Boden's roadmap
    const context = await memberContext(browser, "Maja Sandberg");
    try {
      const page = await context.newPage();
      await openCopyForm(page, goalId, boden.roadmapName ?? "");
      await expectRefusedCopy(page);
    }
    finally {
      await context.close();
    }
  });

  test.describe("into a roadmap of the user's org", () => {
    test.use({ storageState: adminFile });

    test("a first copy goes through, is marked on the org's liked goals, and a second is refused", async ({ page, admin, sandbox }) => {
      // The org's copies of this goal and the admin's like of it are shared by every browser project
      await withLock("goal-copy-leap-as-is", async () => {
        const likedBefore = await likedByViewer(admin, goalId);
        const like = await admin.post("/api/goal-like", { data: { goalId } });
        expect(like.status(), await like.text()).toBe(200);
        const likedRow = visible(page, `[data-testid="liked-goal"][data-goal-id="${goalId}"]`);
        try {
          // Liked but not yet copied into any roadmap of the org
          await gotoUntil(page, `/?org=${sandbox.orgId}`, async () => {
            await expect(likedRow).toBeVisible({ timeout: 5_000 });
            await expect(likedRow.getByTestId("liked-goal-copied")).toHaveCount(0, { timeout: 5_000 });
          }, 90_000);

          await openCopyForm(page, goalId, `Sandbox ${sandbox.label}`);
          const created = await submitCopy(page);
          expect(created.status(), await created.text()).toBe(201);
          const { id: copyId } = await created.json() as { id: string };
          await expect(page).toHaveURL(`/goal/${copyId}`, { timeout: 90_000 });
          await expect(page.getByTestId("goal-indicator-parameter").filter({ visible: true })).toContainText(leafAsIs, { timeout: 30_000 });

          // The landing now says the org has it, naming the copy
          await gotoUntil(page, `/?org=${sandbox.orgId}`, async () => {
            await expect(likedRow.getByTestId("liked-goal-copied")).toBeVisible({ timeout: 5_000 });
          }, 90_000);
          await expect(likedRow.getByTestId("liked-goal-copied")).toHaveAttribute("title", new RegExp(leafAsIs));

          await openCopyForm(page, goalId, `Sandbox ${sandbox.label}`);
          await expectRefusedCopy(page);
        }
        finally {
          // The copies go with the sandbox; the like is put back as it was
          if (!likedBefore) {
            const unlike = await admin.delete("/api/goal-like", { data: { goalId } });
            expect(unlike.status(), await unlike.text()).toBe(200);
          }
        }
      });
    });
  });

  test("a member of an org with an area can preview the goal there; it is copied as is", async ({ browser }) => {
    const context = await memberContext(browser, "Nils Forsberg");
    try {
      const page = await context.newPage();
      await page.goto(`/goal/${goalId}`);

      const toggle = page.getByTestId("scaled-preview-toggle").filter({ visible: true });
      await expect(toggle).toBeVisible({ timeout: 30_000 });
      await expect(toggle.locator("xpath=..")).toContainText(`"area":"${bodenArea}"`);
      await expect(toggle).not.toBeChecked();
      await expect(page.getByTestId("scaled-preview-unscaled")).toHaveCount(0);

      await toggle.check();
      await expect(page.getByTestId("scaled-preview-unscaled").filter({ visible: true })).toContainText("goal.scaled_preview.as_is");
      await expect(page.getByTestId("scaled-preview-result")).toHaveCount(0);

      // The choice follows the user to the next goal page
      await page.reload();
      await expect(page.getByTestId("scaled-preview-toggle").filter({ visible: true })).toBeChecked({ timeout: 30_000 });
    }
    finally {
      await context.close();
    }
  });

  test("a member whose org has no area is not offered the preview", async ({ browser }) => {
    const context = await loginContext(browser, Seed.anita.username, Seed.anita.password);
    try {
      const page = await context.newPage();
      await page.goto(`/goal/${goalId}`);
      // The preview's section streams in next to the use-in-roadmap panel
      await expect(visible(page, "h2").filter({ hasText: /goal\.use_(in_roadmap|locally)\.heading/ })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("scaled-preview-toggle")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });
});
