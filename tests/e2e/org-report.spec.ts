import path from "node:path";
import { cwd } from "node:process";
import type { BrowserContext, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { loginContext, orgIdByName, pageStatus, Seed } from "../lib/api";

/*
 * The org report (`/org/<id>/report`): an org's whole content as one printable document,
 * which the browser's print dialog saves as a PDF. It holds what its viewer may read and
 * nothing else: a visitor gets the public version, those who can write in the org get
 * what they can read and may ask for the public version, and unlisted goals only come
 * along for those who can edit them, on request. Read-only: nothing here changes data.
 *
 * Found by test id and seeded names rather than by text, which is server-rendered and
 * may come out in another language while other tests switch theirs.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/** The unlisted goal on the current version of the ORG-shared regional roadmap */
const unlistedRegionalGoal = Seed.unlistedGoals[1];

const report = (page: Page) => page.getByTestId("org-report").filter({ visible: true });
const roadmap = (page: Page, name: string) => report(page).getByTestId("org-report-roadmap").filter({ has: page.locator("h2", { hasText: name }) });
const goals = (page: Page) => report(page).getByTestId("org-report-goal");

async function openReport(page: Page, orgId: string, query = "") {
  await page.goto(`/org/${orgId}/report${query}`);
  await expect(report(page).getByTestId("org-report-title")).toHaveText(Seed.orgName, { timeout: 60_000 });
}

/** Stands in for the print dialog, which would block the page: counts the calls instead */
async function stubPrint(context: BrowserContext) {
  await context.addInitScript(() => {
    const counter = window as unknown as { printCalls?: number };
    counter.printCalls = 0;
    window.print = () => { counter.printCalls = (counter.printCalls ?? 0) + 1; };
  });
}

const printCalls = (page: Page) => page.evaluate(() => (window as unknown as { printCalls?: number }).printCalls ?? 0);

test.describe("A visitor without a login gets the public version", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("public content only, whatever the address asks for", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);

    for (const query of ["", "?view=working", "?unlisted=true", "?view=working&unlisted=true"]) {
      await openReport(page, orgId, query);
      await expect(report(page)).toHaveAttribute("data-view", "PUBLIC");
      // The public national roadmap, with the goals of its current version
      await expect(roadmap(page, Seed.nationalRoadmap)).toHaveCount(1);
      await expect(roadmap(page, Seed.nationalRoadmap).getByTestId("org-report-goal").first()).toBeVisible();
      // Not the ORG-shared regional one, nor its goals; and no unlisted goal anywhere
      await expect(roadmap(page, Seed.regionalRoadmap)).toHaveCount(0);
      for (const name of Seed.unlistedGoals) await expect(report(page).getByText(name)).toHaveCount(0);
      await expect(report(page).getByTestId("visibility-badge-unlisted")).toHaveCount(0);
      // Nothing says how many unlisted goals there are
      await expect(report(page).getByTestId("org-report-unlisted-left-out")).toHaveCount(0);
      // No names of people, and no switch between versions
      await expect(report(page).getByTestId("org-managers")).toHaveCount(0);
      await expect(page.getByTestId("org-report-versions")).toHaveCount(0);
      await expect(page.getByTestId("org-report-unlisted")).toHaveCount(0);
    }
  });

  test("the document: cover, summary, goals with graph and key years, actions", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await openReport(page, orgId);

    await expect(report(page).getByTestId("org-report-date")).toBeVisible();
    await expect(report(page).getByTestId("org-report-version")).toBeVisible();
    // The landing's key numbers and five-step process, one step in focus
    await expect(report(page).getByTestId("org-numbers")).toBeVisible();
    await expect(report(page).getByTestId("org-process").locator("li")).toHaveCount(5);
    await expect(report(page).getByTestId("org-process").locator('li[aria-current="step"]')).toHaveCount(1);

    // Every goal has its numbers, and a drawn graph with at least one line
    const count = await goals(page).count();
    expect(count).toBeGreaterThan(0);
    await expect(report(page).getByTestId("org-report-goal-years")).toHaveCount(count);
    await expect(report(page).locator('[data-testid="org-report-goal"] svg[role="img"]')).toHaveCount(count);
    await expect(goals(page).first().locator('svg[role="img"] [data-series] path').first()).toBeAttached();
    await expect(goals(page).first().getByTestId("org-report-goal-years").locator("tbody tr").first()).toBeVisible();
    // A goal links to its page
    await expect(goals(page).first().locator('h3 a[href^="/goal/"]')).toBeVisible();

    // The org's actions, in full once
    await expect(report(page).getByTestId("org-report-actions").getByTestId("org-report-action").first()).toBeVisible();
    // An effect under a goal points at the action's entry in the same document
    const effectLink = report(page).getByTestId("org-report-goal-effects").locator('a[href^="#action-"]').first();
    await expect(effectLink).toBeVisible();
    await expect(report(page).locator(`[id="${(await effectLink.getAttribute("href") ?? "").slice(1)}"]`)).toHaveCount(1);
  });

  test("on paper: the app's chrome and the controls are gone, the document stays", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await openReport(page, orgId);
    await expect(page.getByTestId("org-report-toolbar").filter({ visible: true })).toBeVisible();
    await expect(page.locator("aside.print-hidden").first()).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(report(page)).toBeVisible();
    await expect(page.getByTestId("org-report-toolbar")).toBeHidden();
    await expect(page.getByTestId("org-report-print")).toBeHidden();
    await expect(page.locator("aside.print-hidden").first()).toBeHidden();
    // The sheet fills the page: no frame around it
    expect(await report(page).evaluate(element => getComputedStyle(element).boxShadow)).toBe("none");
  });

  test("the landing's export button opens the report and the print dialog, once", async ({ context, page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await stubPrint(context);
    await page.goto(`/?org=${orgId}`);

    const button = page.getByTestId("org-export-pdf").filter({ visible: true });
    await expect(button).toHaveAttribute("href", `/org/${orgId}/report?print=true`, { timeout: 30_000 });
    await button.click();

    await expect(report(page).getByTestId("org-report-title")).toHaveText(Seed.orgName, { timeout: 60_000 });
    await expect.poll(() => printCalls(page), { timeout: 30_000 }).toBe(1);
    // The param is dropped, so a reload doesn't print again
    await expect(page).toHaveURL(new RegExp(`/org/${orgId}/report$`));
    await page.reload();
    await expect(report(page).getByTestId("org-report-title")).toHaveText(Seed.orgName, { timeout: 60_000 });
    await page.getByTestId("org-report-print").filter({ visible: true }).waitFor();
    expect(await printCalls(page)).toBe(0);

    // The button on the report itself prints too
    await page.getByTestId("org-report-print").filter({ visible: true }).click();
    await expect.poll(() => printCalls(page)).toBe(1);
  });

  test("an unknown org has no report", async ({ request }) => {
    expect(await pageStatus(request, "/org/00000000-0000-4000-8000-000000000000/report")).toBe(404);
    expect(await pageStatus(request, "/org/not-an-id/report")).toBe(404);
  });
});

test.describe("A manager gets what they can read", () => {
  test.use({ storageState: adminFile });

  test("member content, named managers, and unlisted goals only on request", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await openReport(page, orgId);

    await expect(report(page)).toHaveAttribute("data-view", "VIEWER");
    await expect(roadmap(page, Seed.nationalRoadmap)).toHaveCount(1);
    // The ORG-shared roadmap is in the member's document, at its published version (not the draft)
    await expect(roadmap(page, Seed.regionalRoadmap)).toHaveCount(1);
    await expect(roadmap(page, Seed.regionalRoadmap).getByTestId("visibility-badge-draft")).toHaveCount(0);
    await expect(report(page).getByTestId("org-managers")).toContainText(Seed.admin.name);

    // Unlisted goals stay out, and the document says how many
    await expect(report(page).getByText(unlistedRegionalGoal)).toHaveCount(0);
    await expect(roadmap(page, Seed.regionalRoadmap).getByTestId("org-report-unlisted-left-out")).toBeVisible();
    const listed = await roadmap(page, Seed.regionalRoadmap).getByTestId("org-report-goal").count();

    await page.getByTestId("org-report-unlisted").filter({ visible: true }).click();
    await expect(page).toHaveURL(/unlisted=true/, { timeout: 30_000 });
    await expect(roadmap(page, Seed.regionalRoadmap).getByText(unlistedRegionalGoal)).toBeVisible({ timeout: 60_000 });
    await expect(roadmap(page, Seed.regionalRoadmap).getByTestId("org-report-goal")).toHaveCount(listed + 1);
    await expect(roadmap(page, Seed.regionalRoadmap).getByTestId("org-report-unlisted-left-out")).toHaveCount(0);
  });

  test("the public version is the visitor's document", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await openReport(page, orgId);
    await page.getByTestId("org-report-versions").filter({ visible: true }).locator('a[data-view="PUBLIC"]').click();

    await expect(page).toHaveURL(/view=public/, { timeout: 30_000 });
    await expect(report(page)).toHaveAttribute("data-view", "PUBLIC", { timeout: 60_000 });
    await expect(roadmap(page, Seed.nationalRoadmap)).toHaveCount(1);
    await expect(roadmap(page, Seed.regionalRoadmap)).toHaveCount(0);
    await expect(report(page).getByTestId("org-managers")).toHaveCount(0);
    // Unlisted goals can't be added to the public version, not by address either
    await expect(page.getByTestId("org-report-unlisted")).toHaveCount(0);
    await openReport(page, orgId, "?view=public&unlisted=true");
    await expect(report(page)).toHaveAttribute("data-view", "PUBLIC");
    await expect(report(page).getByText(unlistedRegionalGoal)).toHaveCount(0);
  });

  test("the working view's export button asks for the viewer's version, the preview's for the public one", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    await page.goto(`/?org=${orgId}`);
    await expect(page.getByTestId("org-export-pdf").filter({ visible: true })).toHaveAttribute("href", `/org/${orgId}/report?print=true`, { timeout: 30_000 });

    await page.goto(`/?org=${orgId}&view=public`);
    await expect(page.getByTestId("org-export-pdf").filter({ visible: true })).toHaveAttribute("href", `/org/${orgId}/report?view=public&print=true`, { timeout: 30_000 });
  });
});

test.describe("A writer without edit access everywhere", () => {
  test.use({ storageState: verifiedFile });

  test("asking for unlisted goals gives only those of roadmaps they can edit", async ({ page, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    // Anita's group can edit the national roadmap but only read the regional one
    await openReport(page, orgId, "?unlisted=true");

    await expect(report(page)).toHaveAttribute("data-view", "VIEWER");
    await expect(roadmap(page, Seed.regionalRoadmap)).toHaveCount(1);
    await expect(report(page).getByText(unlistedRegionalGoal)).toHaveCount(0);
    await expect(roadmap(page, Seed.regionalRoadmap).getByTestId("org-report-unlisted-left-out")).toHaveCount(0);
  });
});

test.describe("A signed-in user of no org", () => {
  test("gets public content, with the managers named, and no version switch", async ({ browser, admin }) => {
    const orgId = await orgIdByName(admin, Seed.orgName);
    const context = await loginContext(browser, Seed.orgless.username);
    try {
      const page = await context.newPage();
      await openReport(page, orgId, "?unlisted=true");
      await expect(roadmap(page, Seed.nationalRoadmap)).toHaveCount(1);
      await expect(roadmap(page, Seed.regionalRoadmap)).toHaveCount(0);
      await expect(report(page).getByText(unlistedRegionalGoal)).toHaveCount(0);
      await expect(report(page).getByTestId("org-managers")).toContainText(Seed.admin.name);
      await expect(page.getByTestId("org-report-versions")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });
});
