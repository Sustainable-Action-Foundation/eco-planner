import path from "node:path";
import { cwd } from "node:process";
import type { BrowserContext, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createIteration, createRoadmap, deleteRoadmap, loginContext, memberContext, orgIdByName, putJson, Seed } from "../lib/api";
import { visible } from "../lib/forms";
import { seedPlaces } from "../../scripts/prisma/seed/places";

/*
 * The org landing's two views. The public view is what visitors, users of other
 * orgs and members without write access get; the working view (tabs) is for those
 * who can write something in the org, who land on it and may switch. Nothing here
 * changes an org: the hidden-roadmap test works on a throwaway roadmap.
 *
 * Found by test id and href rather than by text, which is server-rendered and
 * may come out in another language while other tests switch theirs.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/** A seeded place nobody but its own two members belongs to; its second member is a plain member without grants */
const kiruna = seedPlaces.find(place => place.name === "Kiruna kommun");
if (!kiruna) throw new Error("Kiruna kommun is missing from the seed roster");
const kirunaMember = kiruna.members[1];

const publicView = (page: Page) => page.getByTestId("org-hero").filter({ visible: true });
const workingView = (page: Page) => page.getByTestId("org-working-header").filter({ visible: true });
const viewToggle = (page: Page) => page.getByTestId("org-view-toggle").filter({ visible: true });
const tabs = (page: Page) => page.getByTestId("org-tabs").filter({ visible: true });
const tabPanel = (page: Page) => page.getByTestId("org-tab-panel").filter({ visible: true });
const homeTitle = (page: Page) => page.getByTestId("home-title").filter({ visible: true });

/** The public view and nothing of the working one: no toggle, no tabs */
async function expectOnlyPublicView(page: Page, orgName: string) {
  await expect(homeTitle(page)).toHaveText(orgName, { timeout: 30_000 });
  await expect(publicView(page)).toBeVisible();
  await expect(page.getByTestId("org-process").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  await expect(workingView(page)).toHaveCount(0);
  await expect(viewToggle(page)).toHaveCount(0);
  await expect(tabs(page)).toHaveCount(0);
  await expect(page.getByTestId("org-preview-note")).toHaveCount(0);
}

test.describe("Outsiders get the public view", () => {
  let contexts: BrowserContext[] = [];
  test.afterEach(async () => {
    await Promise.all(contexts.map(context => context.close()));
    contexts = [];
  });

  test("a visitor without a login, and a user of no org: public view, no toggle, whatever the URL asks for", async ({ browser, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const orgless = await loginContext(browser, Seed.orgless.username);
    contexts.push(anonymous, orgless);

    for (const context of [anonymous, orgless]) {
      const page = await context.newPage();
      for (const url of [`/?org=${orgId}`, `/?org=${orgId}&view=working`, `/?org=${orgId}&tab=roadmaps`, `/?org=${orgId}&view=working&tab=members`]) {
        await page.goto(url);
        await expectOnlyPublicView(page, Seed.orgName);
      }
      // No names of people for a visitor; the member list is nowhere
      await expect(page.getByTestId("org-members")).toHaveCount(0);
      await page.close();
    }

    const visitor = await anonymous.newPage();
    await visitor.goto(`/?org=${orgId}`);
    await expect(homeTitle(visitor)).toHaveText(Seed.orgName, { timeout: 30_000 });
    await expect(visitor.getByTestId("org-managers")).toHaveCount(0);
    // The public national roadmap is there for anyone
    await expect(visible(visitor, "main").locator('a[href^="/roadmap/"]').filter({ hasText: Seed.nationalRoadmap }).first()).toBeVisible({ timeout: 30_000 });
    // The ORG-shared regional one is not
    await expect(visible(visitor, "main").locator('a[href^="/roadmap/"]').filter({ hasText: Seed.regionalRoadmap })).toHaveCount(0);
  });

  test("a member without write access gets the public view of their own org", async ({ browser }) => {
    const member = await memberContext(browser, kirunaMember);
    contexts.push(member);
    const page = await member.newPage();

    await page.goto("/");
    await expectOnlyPublicView(page, kiruna.name);
    const orgId = new URL(await visible(page, "main > nav").locator('a[href^="/?org="]:not([href="/?org=public"])').first().getAttribute("href") ?? "", "http://localhost").searchParams.get("org") ?? "";
    expect(orgId).toBeTruthy();

    await page.goto(`/?org=${orgId}&view=working&tab=roadmaps`);
    await expectOnlyPublicView(page, kiruna.name);
    // Signed in, so the managers are named
    await expect(page.getByTestId("org-managers").filter({ visible: true })).toContainText(kiruna.members[0], { timeout: 30_000 });
  });
});

test.describe("Writers get the working view", () => {
  test.use({ storageState: verifiedFile });

  test("a writer lands on the working view and switches to the public one and back", async ({ page }) => {
    await page.goto("/");
    await expect(homeTitle(page)).toHaveText(Seed.orgName, { timeout: 30_000 });
    await expect(workingView(page)).toBeVisible();
    await expect(publicView(page)).toHaveCount(0);
    await expect(viewToggle(page).locator('a[data-view="WORKING"]')).toHaveAttribute("aria-current", "page");
    await expect(tabs(page).locator('a[data-tab="OVERVIEW"]')).toHaveAttribute("aria-current", "page");
    // One next step, on the overview
    await expect(page.getByTestId("org-next-step-link").filter({ visible: true })).toHaveCount(1, { timeout: 30_000 });
    // A writer who doesn't manage the org has no member tab, also not by URL
    await expect(tabs(page).locator('a[data-tab="MEMBERS"]')).toHaveCount(0);

    await viewToggle(page).locator('a[data-view="PUBLIC"]').click();
    await expect(page).toHaveURL(/view=public/, { timeout: 30_000 });
    await expect(publicView(page)).toBeVisible({ timeout: 30_000 });
    await expect(workingView(page)).toHaveCount(0);
    await expect(tabs(page)).toHaveCount(0);
    await expect(viewToggle(page).locator('a[data-view="PUBLIC"]')).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("org-preview-note").filter({ visible: true })).toBeVisible();
    // The preview is a visitor's: the ORG-shared regional roadmap is not in it
    await expect(visible(page, "main").locator('a[href^="/roadmap/"]').filter({ hasText: Seed.nationalRoadmap }).first()).toBeVisible({ timeout: 30_000 });
    await expect(visible(page, "main").locator('a[href^="/roadmap/"]').filter({ hasText: Seed.regionalRoadmap })).toHaveCount(0);

    await viewToggle(page).locator('a[data-view="WORKING"]').click();
    await expect(workingView(page)).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(/view=public/);
  });

  test("tabs render by URL; the member tab falls back to the overview for a non-manager", async ({ page }) => {
    await page.goto("/?tab=roadmaps");
    await expect(tabs(page).locator('a[data-tab="ROADMAPS"]')).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
    await expect(tabPanel(page)).toHaveAttribute("data-tab", "ROADMAPS");

    await tabs(page).locator('a[data-tab="COMMENTS"]').click();
    await expect(page).toHaveURL(/tab=comments/, { timeout: 30_000 });
    await expect(tabPanel(page)).toHaveAttribute("data-tab", "COMMENTS", { timeout: 30_000 });

    await page.goto("/?tab=members");
    await expect(tabPanel(page)).toHaveAttribute("data-tab", "OVERVIEW", { timeout: 30_000 });
    await expect(page.getByTestId("org-members")).toHaveCount(0);
  });

  test("what a writer can only read carries the read-only badge and no edit controls", async ({ page }) => {
    await page.goto("/?tab=roadmaps");
    const row = (name: string) => tabPanel(page).locator("li").filter({ has: page.locator('a[href^="/roadmap/"]').filter({ hasText: name }) }).last();

    // Anita's group has a read-write grant on the national roadmap and a read-only one on the regional
    await expect(row(Seed.nationalRoadmap)).toBeVisible({ timeout: 30_000 });
    // The regional roadmap nests under the national one, folded away until its parent is opened
    await expect(row(Seed.regionalRoadmap).getByTestId("visibility-badge-read-only")).toBeAttached();
    await expect(tabPanel(page).locator('a[data-testid="roadmap-tree-version"]').filter({ hasText: Seed.nationalRoadmap }).getByTestId("visibility-badge-read-only")).toHaveCount(0);
    // The regional draft is for editors only
    await expect(tabPanel(page).locator('a[data-testid="roadmap-tree-draft"]').filter({ hasText: Seed.regionalRoadmap })).toHaveCount(0);
  });
});

test.describe("Managers", () => {
  test.use({ storageState: adminFile });

  test("the member tab lists the org's members for those who manage it", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await page.goto(`/?org=${orgId}&tab=members`);
    await expect(tabPanel(page)).toHaveAttribute("data-tab", "MEMBERS", { timeout: 30_000 });
    await expect(page.getByTestId("org-members").filter({ visible: true })).toContainText(Seed.anita.name, { timeout: 30_000 });
    await expect(tabPanel(page).locator(`a[href="/org/${orgId}/groups"]`)).toBeVisible();
  });

  test("a hidden roadmap never shows in the public view", async ({ page, browser, admin, sandbox }, testInfo) => {
    test.slow();
    const name = `Hidden public ${sandbox.label}`;
    const roadmapId = await createRoadmap(admin, sandbox.orgId, { name, access: { sharing: "PUBLIC", grants: [] } });
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      await createIteration(admin, roadmapId);
      const links = (view: Page) => visible(view, "main").locator(`a[href^="/roadmap/${roadmapId}"]`);
      const visitor = await anonymous.newPage();

      // Public and listed: a visitor sees it (so the checks below aren't vacuous)
      await expect(async () => {
        await visitor.goto(`/?org=${sandbox.orgId}`);
        await expect(links(visitor).first()).toBeVisible({ timeout: 15_000 });
      }).toPass({ timeout: 120_000 });

      await putJson(admin, "/api/roadmap", { id: roadmapId, timestamp: Date.now(), hidden: true });

      // Gone for the visitor, with or without the toggle's param
      await expect(async () => {
        await visitor.goto(`/?org=${sandbox.orgId}&showHidden=true`);
        await expect(publicView(visitor)).toBeVisible({ timeout: 15_000 });
        await expect(visitor.getByTestId("org-process").filter({ visible: true })).toBeVisible({ timeout: 15_000 });
        await expect(links(visitor)).toHaveCount(0, { timeout: 5_000 });
      }).toPass({ timeout: 120_000 });
      expect(await visitor.content(), `${testInfo.title}: the hidden roadmap's name in the visitor's page`).not.toContain(name);

      // Gone from the manager's preview of the public view too, toggle param or not
      await page.goto(`/?org=${sandbox.orgId}&view=public&showHidden=true`);
      await expect(publicView(page)).toBeVisible({ timeout: 30_000 });
      await expect(visible(page, "main").locator('a[href^="/roadmap/"]').filter({ hasText: Seed.nationalRoadmap }).first()).toBeVisible({ timeout: 30_000 });
      await expect(links(page)).toHaveCount(0);
      await expect(page.getByTestId("show-hidden-roadmaps")).toHaveCount(0);

      // While the working view brings it back on request, marked hidden
      await page.goto(`/?org=${sandbox.orgId}&tab=roadmaps`);
      await expect(tabPanel(page)).toHaveAttribute("data-tab", "ROADMAPS", { timeout: 30_000 });
      await expect(links(page)).toHaveCount(0);
      await page.getByTestId("show-hidden-roadmaps").filter({ visible: true }).click();
      await page.waitForURL(/showHidden=true/);
      await expect(links(page).first()).toBeVisible({ timeout: 30_000 });
      await expect(links(page).first().getByTestId("visibility-badge-hidden")).toBeVisible();
    }
    finally {
      await anonymous.close();
      await deleteRoadmap(admin, roadmapId);
    }
  });
});
