import path from "node:path";
import { cwd } from "node:process";
import type { APIRequestContext, BrowserContext, Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createGoal, createIteration, createRoadmap, deleteRoadmap, memberContext, orgIdByName, putJson, Seed, uniqueLabel } from "../lib/api";
import { pickSingleSearchOption, visible } from "../lib/forms";
import { withLock } from "../lib/lock";
import { memberSlug, seedPlaces } from "../../scripts/prisma/seed/places";

/*
 * The org landing page per role, and org administration on the groups page.
 * Only "Malmö stad" is ever changed: its manager renames it, moves it to
 * another area and creates groups, each test under one cross-process lock
 * (the browser projects run in parallel) and restored in `finally`.
 *
 * Server-rendered text can come out in another language while other tests
 * switch theirs (the server's i18n instance is shared), so the switcher and
 * links are found by href/value rather than by their translated labels.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

const malmo = seedPlaces.find(place => place.name === "Malmö stad");
if (!malmo) throw new Error("Malmö stad is missing from the seed roster");
const [malmoManager, malmoMember] = malmo.members;
/** An org admin can see but is no member of */
const foreignOrg = seedPlaces.find(place => place.adminRole === null && place.name !== malmo.name);
if (!foreignOrg) throw new Error("no seeded org without an admin membership");
/** The municipality Malmö is moved to and back from */
const otherArea = { name: "Lund", code: "1281" };

/** Puts Malmö's seeded state back, retrying through a dev server restart (a dropped connection) */
async function restoreOrg(api: APIRequestContext, body: { orgId: string, name?: string, geoAreaCode?: string }) {
  await expect(async () => {
    await putJson(api, "/api/org", body);
  }).toPass({ timeout: 120_000, intervals: [2_000, 5_000, 10_000] });
}

/** The start page's org switcher: chips, or a select past the chip limit; both end with the public view */
function orgSwitcher(page: Page): Locator {
  return visible(page, "main nav").filter({ has: page.locator('a[href="/?org=public"], option[value="public"]') });
}

function homeTitle(page: Page): Locator {
  return page.getByTestId("home-title").filter({ visible: true });
}

/** The landing's link to the org's groups page (managers and super admins only) */
function manageLink(page: Page, orgId?: string): Locator {
  return visible(page, "main").locator(orgId ? `a[href="/org/${orgId}/groups"]` : 'a[href^="/org/"][href$="/groups"]');
}

/** Roadmap links in the visible page */
function roadmapLinks(page: Page, name: string): Locator {
  return visible(page, "main").locator('a[href^="/roadmap/"]').filter({ hasText: name });
}

/** The public view: the roadmap search and the image hero, which an org landing lacks */
async function expectPublicView(page: Page) {
  await expect(visible(page, "#roadmap-search-title")).toBeVisible();
  await expect(visible(page, "main img").first()).toBeVisible();
}

/**
 * `page.goto` that survives the page's own pending client navigation (a
 * `router.refresh()` after a save): Firefox and WebKit abort the goto
 * instead of superseding it, so go once more.
 */
async function gotoSettled(page: Page, url: string) {
  try {
    await page.goto(url);
  }
  catch (err) {
    // Firefox: NS_BINDING_ABORTED / NS_ERROR_FAILURE; WebKit: "interrupted by another navigation"
    if (!/NS_BINDING_ABORTED|NS_ERROR_FAILURE|interrupted by another navigation|frame was detached/.test(String(err))) throw err;
    await page.goto(url);
  }
}

/**
 * Reloads until the assertion holds. Tag revalidation on the start page's cached
 * org list and liked goals has been seen to serve the pre-change render once
 * (stale-while-revalidate, see the caching spec), so the first look may be stale;
 * a list that never refreshes still fails.
 */
async function expectAfterReload(page: Page, url: string, assertion: () => Promise<void>) {
  await gotoSettled(page, url);
  await expect(async () => {
    try {
      await assertion();
    }
    catch (err) {
      await page.reload();
      throw err;
    }
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
}

test.describe("Org landing as super admin", () => {
  test.use({ storageState: adminFile });

  test("the switcher is a select of every org, memberships first, then the public view", async ({ page }) => {
    await page.goto("/");
    const select = orgSwitcher(page).locator("select");
    await expect(select).toBeVisible();
    await expect(orgSwitcher(page).locator("a")).toHaveCount(0);

    // Every org (other specs rename some seeded ones for a moment, so count rather than name them all)
    await expect(select.locator("option")).toHaveCount(1 + seedPlaces.length + 1);
    const labels = (await select.locator("option").allTextContents()).map(label => label.trim());
    for (const name of [Seed.orgName, foreignOrg.name]) {
      expect(labels, `option for ${name}`).toContain(name);
    }
    await expect(select.locator("option").last()).toHaveAttribute("value", "public");
    // Memberships first: every org admin belongs to precedes the ones he only sees as super admin
    expect(labels.indexOf(Seed.orgName)).toBeLessThan(labels.indexOf(foreignOrg.name));
  });

  test("a super admin traverses an org he is no member of and may manage it", async ({ page }) => {
    await page.goto("/");
    const select = orgSwitcher(page).locator("select");
    await select.selectOption({ label: foreignOrg.name });

    await expect(page).toHaveURL(/\?org=[0-9a-f-]{36}$/, { timeout: 30_000 });
    const orgId = new URL(page.url()).searchParams.get("org") ?? "";
    await expect(homeTitle(page)).toHaveText(foreignOrg.name);
    await expect(orgSwitcher(page).locator("select")).toHaveValue(orgId);
    await expect(manageLink(page, orgId)).toBeVisible();
  });

  test("?org=public restores the public view", async ({ page }) => {
    await page.goto("/?org=public");
    await expectPublicView(page);
    await expect(orgSwitcher(page).locator("select")).toHaveValue("public");
  });

  test("a searchFilter deep link filters the org landing's roadmaps", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    const others = () => visible(page, "main").locator('a[href^="/roadmap/"]:not([href="/roadmap/create"])').filter({ visible: true }).filter({ hasNotText: Seed.nationalRoadmap });

    // Unfiltered, the org has other top-level roadmaps besides the national one
    await page.goto(`/?org=${orgId}`);
    await expect(homeTitle(page)).toHaveText(Seed.orgName);
    await expect(roadmapLinks(page, Seed.nationalRoadmap).first()).toBeVisible();
    await expect(others().first()).toBeVisible();

    await page.goto(`/?org=${orgId}&searchFilter=${encodeURIComponent(Seed.nationalRoadmap)}`);
    await expect(homeTitle(page)).toHaveText(Seed.orgName);
    await expect(roadmapLinks(page, Seed.nationalRoadmap).first()).toBeVisible();
    await expect(others()).toHaveCount(0);
  });
});

test.describe("Org landing as a plain member", () => {
  test.use({ storageState: verifiedFile });

  test("a member of one org lands on it, with chips and no manage link", async ({ page }) => {
    await page.goto("/");
    await expect(homeTitle(page)).toHaveText(Seed.orgName);
    // One chip for the org and one for the public view
    await expect(orgSwitcher(page).locator("a")).toHaveCount(2);
    await expect(orgSwitcher(page).locator("select")).toHaveCount(0);
    await expect(orgSwitcher(page).locator('a[href^="/?org="]').first()).toHaveText(Seed.orgName);
    await expect(manageLink(page)).toHaveCount(0);
  });
});

test.describe("Org landing logged out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("anonymous visitors get the public view without a switcher", async ({ page }) => {
    await page.goto("/");
    await expectPublicView(page);
    await expect(visible(page, "main nav").filter({ has: page.locator('a[href="/?org=public"], option[value="public"]') })).toHaveCount(0);
  });
});

test.describe("Org administration (Malmö stad)", () => {
  // Malmö's landing streams statistics sections, and the lock may first wait for the other browser
  test.describe.configure({ timeout: 240_000 });

  let manager: BrowserContext;
  let member: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    manager = await memberContext(browser, malmoManager);
    member = await memberContext(browser, malmoMember);
  });

  test.afterEach(async () => {
    await manager.close();
    await member.close();
  });

  /** Opens the groups page from the manager's landing (Malmö's: his only org); resolves with the org id */
  async function openGroupsPage(page: Page): Promise<string> {
    await page.goto("/");
    // His one org chip comes first (found by href: the name may be mid-rename by another test's restore)
    const chip = orgSwitcher(page).locator('a[href^="/?org="]:not([href="/?org=public"])');
    await expect(chip).toHaveCount(1);
    const orgId = new URL(await chip.getAttribute("href") ?? "", "http://localhost").searchParams.get("org") ?? "";
    await expect(manageLink(page, orgId)).toBeVisible();
    await gotoSettled(page, `/org/${orgId}/groups`);
    await expect(page.getByTestId("group-create").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    return orgId;
  }

  /** Picks members in a SelectMultipleSearch by username; clicking a picked one again unpicks it */
  async function toggleMembers(page: Page, combobox: Locator, usernames: string[]) {
    await combobox.click();
    const dialog = visible(page, '[id$="-dialog"]').filter({ has: page.locator('[id$="-dialog-listbox"]') });
    for (const username of usernames) {
      await dialog.locator('input[type="text"]').fill(username);
      await dialog.locator('[id$="-dialog-listbox"] li').filter({ hasText: username }).first().click();
    }
    await page.keyboard.press("Escape");
  }

  function toast(page: Page, kind: "success" | "error"): Locator {
    return page.getByTestId("toast-list").locator(`dialog[role="${kind === "error" ? "alert" : "status"}"]`).filter({ hasText: `toasts.${kind}` });
  }

  /** Waits for a request of the group manager's forms and returns its status */
  async function groupRequest(page: Page, method: "POST" | "PUT" | "DELETE", action: () => Promise<void>): Promise<number> {
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === "/api/group" && response.request().method() === method),
      action(),
    ]);
    return response.status();
  }

  test("a manager creates, renames, re-members and deletes a group", async ({ playwright, baseURL }, testInfo) => {
    const name = `Group ${uniqueLabel(testInfo)}`;
    const renamed = `${name} renamed`;
    const managerSlug = memberSlug(malmoManager);
    const memberSlugName = memberSlug(malmoMember);
    const api = await playwright.request.newContext({ baseURL, storageState: await manager.storageState() });
    let groupId: string | null = null;
    const page = await manager.newPage();
    try {
      await withLock("malmo-stad", async () => {
        await openGroupsPage(page);

        // Create with both members
        await visible(page, '[data-testid="create-group-name"]').fill(name);
        await toggleMembers(page, visible(page, "#create-group-members"), [managerSlug, memberSlugName]);
        expect(await groupRequest(page, "POST", () => page.getByTestId("create-group-submit").filter({ visible: true }).click())).toBe(201);
        const row = page.getByTestId("group-row").filter({ visible: true }).filter({ hasText: name });
        // The list comes back through router.refresh(); like the switcher it may need a second render
        await expectAfterReload(page, page.url(), async () => {
          await expect(row).toBeVisible({ timeout: 10_000 });
        });
        await expect(row).toContainText(managerSlug);
        await expect(row).toContainText(memberSlugName);
        const item = page.locator("li[data-group-id]").filter({ visible: true }).filter({ has: row });
        groupId = await item.getAttribute("data-group-id");
        expect(groupId).toBeTruthy();

        // A second group by the same name is refused
        await visible(page, '[data-testid="create-group-name"]').fill(name);
        expect(await groupRequest(page, "POST", () => page.getByTestId("create-group-submit").filter({ visible: true }).click())).toBe(400);
        await expect(toast(page, "error")).toBeVisible();
        await expect(page.getByTestId("group-row").filter({ visible: true }).filter({ hasText: name })).toHaveCount(1);

        // Rename and drop the manager; the editor stays open through the refresh with the saved state
        const group = page.locator(`li[data-group-id="${groupId}"]`).filter({ visible: true });
        await group.getByTestId("group-edit").click();
        await expect(group.getByTestId("group-editor")).toBeVisible();
        await toggleMembers(page, group.locator('button[role="combobox"]'), [managerSlug]);
        await group.getByTestId("group-name").fill(renamed);
        expect(await groupRequest(page, "PUT", () => group.getByTestId("group-save").click())).toBe(200);
        await expect(group.getByTestId("group-name")).toHaveValue(renamed);
        await expect(group.locator('button[role="combobox"]')).toContainText(memberSlugName);
        await expect(group.locator('button[role="combobox"]')).not.toContainText(managerSlug);

        await group.getByTestId("group-cancel").click();
        await expect(group.getByTestId("group-row")).toContainText(renamed);
        await expect(group.getByTestId("group-row")).not.toContainText(managerSlug);

        // Deleting takes two clicks: the first only arms the button
        await group.getByTestId("group-edit").click();
        const deleteButton = group.getByTestId("group-delete");
        await deleteButton.click();
        await expect(deleteButton).toHaveText("org_groups.confirm_delete");
        await expect(page.locator(`li[data-group-id="${groupId}"]`).filter({ visible: true })).toHaveCount(1);
        expect(await groupRequest(page, "DELETE", () => deleteButton.click())).toBe(200);
        await expectAfterReload(page, page.url(), async () => {
          await expect(page.locator(`li[data-group-id="${groupId}"]`).filter({ visible: true })).toHaveCount(0, { timeout: 10_000 });
        });
        groupId = null;
      });
    }
    finally {
      if (groupId) await api.delete("/api/group", { data: { groupId } });
      await api.dispose();
    }
  });

  test("a rename shows in the org switcher", async ({ playwright, baseURL }, testInfo) => {
    const name = `${malmo.name} ${uniqueLabel(testInfo)}`;
    const api = await playwright.request.newContext({ baseURL, storageState: await manager.storageState() });
    const page = await manager.newPage();
    const memberPage = await member.newPage();
    let orgId = "";
    try {
      await withLock("malmo-stad", async () => {
        orgId = await openGroupsPage(page);
        const form = page.getByTestId("org-rename-form").filter({ visible: true });
        await expect(form.getByTestId("org-name")).toHaveValue(malmo.name);
        // Nothing to save until the name changes
        await expect(form.getByTestId("org-rename-save")).toBeDisabled();
        await form.getByTestId("org-name").fill(name);
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === "/api/org" && response.request().method() === "PUT"),
          form.getByTestId("org-rename-save").click(),
        ]);
        expect(response.status()).toBe(200);
        await expect(toast(page, "success")).toBeVisible();

        // Both members' switchers and landings carry the new name
        for (const view of [page, memberPage]) {
          await expectAfterReload(view, "/", async () => {
            await expect(orgSwitcher(view).locator(`a[href="/?org=${orgId}"]`)).toHaveText(name, { timeout: 5_000 });
            await expect(homeTitle(view)).toHaveText(name, { timeout: 5_000 });
          });
        }
      });
    }
    finally {
      if (orgId) await restoreOrg(api, { orgId, name: malmo.name });
      await api.dispose();
    }
  });

  test("the area form moves the org and refuses unknown areas", async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL, storageState: await manager.storageState() });
    const page = await manager.newPage();
    let orgId = "";
    try {
      await withLock("malmo-stad", async () => {
        orgId = await openGroupsPage(page);
        const form = page.getByTestId("org-area-form").filter({ visible: true });
        await expect(form.locator("#org-area")).toContainText("Malmö");
        await expect(form.getByTestId("org-area-save")).toBeDisabled();

        await pickSingleSearchOption(page, "org-area", otherArea.name);
        await expect(form.getByTestId("org-area-save")).toBeEnabled();
        const [response] = await Promise.all([
          page.waitForResponse(response => new URL(response.url()).pathname === "/api/org" && response.request().method() === "PUT"),
          form.getByTestId("org-area-save").click(),
        ]);
        expect(response.status()).toBe(200);
        expect(JSON.parse(response.request().postData() ?? "{}")).toMatchObject({ orgId, geoAreaCode: otherArea.code });
        await expect(toast(page, "success")).toBeVisible();
        // The form remounts with the stored area and nothing left to save
        await expect(form.locator("#org-area")).toContainText(otherArea.name);
        await expect(form.getByTestId("org-area-save")).toBeDisabled();

        // A made-up area code is refused and leaves the area alone
        const unknown = await api.put("/api/org", { data: { orgId, geoAreaCode: "9999" } });
        expect(unknown.status()).toBe(400);
        await page.reload();
        await expect(form.locator("#org-area")).toContainText(otherArea.name);
      });
    }
    finally {
      if (orgId) await restoreOrg(api, { orgId, geoAreaCode: malmo.geoCode });
      await api.dispose();
    }
  });

  test("members' likes rank on the landing, per scope", async ({ admin, playwright, baseURL }, testInfo) => {
    const label = uniqueLabel(testInfo);
    // A public goal of another org, so both Malmö members can see and like it
    const roadmapId = await createRoadmap(admin, await orgIdByName(admin, Seed.orgName), { name: `Likes ${label}`, access: { sharing: "PUBLIC", grants: [] } });
    const managerApi: APIRequestContext = await playwright.request.newContext({ baseURL, storageState: await manager.storageState() });
    const goalName = `Liked goal ${label}`;
    let goalId = "";
    try {
      goalId = await createGoal(admin, await createIteration(admin, roadmapId), { name: goalName });
      await withLock("malmo-stad", async () => {
        const page = await manager.newPage();
        const likedRow = (view: Page) => view.getByTestId("liked-goal").filter({ visible: true }).filter({ has: view.locator(`a[href="/goal/${goalId}"]`) });
        const likeButton = (scope: Page | Locator) => scope.getByTestId("goal-like-button").filter({ visible: true });
        const scopeLink = (view: Page, scope: "ORG" | "AREA" | "COUNTY") => view.getByTestId("liked-goals-scope").filter({ visible: true }).locator(`a[data-scope="${scope}"]`);
        const saveLike = async (view: Page, button: Locator) => {
          const [response] = await Promise.all([
            view.waitForResponse(response => new URL(response.url()).pathname === "/api/goal-like"),
            button.click(),
          ]);
          expect(response.status()).toBe(200);
        };

        // The manager likes it on the goal page
        await page.goto(`/goal/${goalId}`);
        await expect(likeButton(page)).toHaveAttribute("aria-pressed", "false");
        await saveLike(page, likeButton(page));
        await expect(likeButton(page)).toHaveAttribute("aria-pressed", "true");
        await expect(likeButton(page).getByTestId("goal-like-count")).toHaveText("1");

        // Ranked on Malmö's landing in the org's own scope
        await expectAfterReload(page, "/", async () => {
          await expect(likedRow(page)).toHaveCount(1, { timeout: 5_000 });
        });
        await expect(scopeLink(page, "ORG")).toHaveAttribute("aria-current", "true");
        await expect(likeButton(likedRow(page))).toHaveAttribute("aria-pressed", "true");

        // The other member sees the org's like, not as her own
        const memberPage = await member.newPage();
        await expectAfterReload(memberPage, "/", async () => {
          await expect(likedRow(memberPage)).toHaveCount(1, { timeout: 5_000 });
        });
        await expect(likeButton(likedRow(memberPage))).toHaveAttribute("aria-pressed", "false");
        await expect(likeButton(likedRow(memberPage)).getByTestId("goal-like-count")).toHaveText("1");

        // Malmö is a municipality: the area and the county widen the list, the like stays in it
        for (const scope of ["AREA", "COUNTY"] as const) {
          await scopeLink(page, scope).click();
          await expect(page).toHaveURL(new RegExp(`likes=${scope.toLowerCase()}`));
          await expect(scopeLink(page, scope)).toHaveAttribute("aria-current", "true");
          await expectAfterReload(page, page.url(), async () => {
            await expect(likedRow(page)).toHaveCount(1, { timeout: 5_000 });
          });
          await expect(likedRow(page).getByTestId("liked-goal-org-count")).toBeVisible();
        }

        // Unliking from the list drops it
        await scopeLink(page, "ORG").click();
        await expect(scopeLink(page, "ORG")).toHaveAttribute("aria-current", "true");
        await saveLike(page, likeButton(likedRow(page)));
        await expectAfterReload(page, "/", async () => {
          await expect(likedRow(page)).toHaveCount(0, { timeout: 5_000 });
        });
      });
    }
    finally {
      if (goalId) {
        await expect(async () => {
          expect((await managerApi.delete("/api/goal-like", { data: { goalId } })).status()).toBe(200);
        }).toPass({ timeout: 120_000, intervals: [2_000, 5_000, 10_000] });
      }
      await managerApi.dispose();
      await deleteRoadmap(admin, roadmapId);
    }
  });
});
