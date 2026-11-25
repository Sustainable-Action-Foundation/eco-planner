import type { Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createRoadmap, deleteRoadmap, loginContext, orgIdByName, Seed } from "../lib/api";
import { orgSwitcherControls, orgSwitcherEntries } from "../lib/org-switcher";
import { seedPlaces } from "../../scripts/prisma/seed/places";

/*
 * A super admin switches their powers off on their own profile page and sees the
 * start page as a regular member: orgs reachable only through the super-admin
 * override leave the org switcher, and the sidebar reminds them on every page.
 * Runs in its own logged-in context: the switch lives in the session cookie.
 */

/** An org admin can see but is no member of */
const foreignOrg = seedPlaces.find(place => place.adminRole === null);
if (!foreignOrg) throw new Error("no seeded org without an admin membership");
const foreignName = foreignOrg.name;

/** The foreign org's entry in the start page's switcher (chip or select option) */
function foreignEntry(page: Page): Locator {
  return orgSwitcherEntries(page).filter({ hasText: foreignName });
}

test("super admin toggles their powers off and back on", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await loginContext(browser, Seed.admin.username);
  const page = await context.newPage();
  try {
    const toggle = page.getByTestId("super-admin-toggle").filter({ visible: true });
    const indicator = page.getByTestId("super-admin-suspended").filter({ visible: true });

    await page.goto("/");
    await expect(foreignEntry(page)).toHaveCount(1);
    await expect(indicator).toHaveCount(0);

    await page.goto(`/@${Seed.admin.username}`);
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(indicator).toBeVisible();

    await page.goto("/");
    await expect(orgSwitcherControls(page).first()).toBeAttached();
    await expect(foreignEntry(page)).toHaveCount(0);
    await expect(indicator).toBeVisible();

    await page.goto(`/@${Seed.admin.username}`);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(indicator).toHaveCount(0);

    await page.goto("/");
    await expect(foreignEntry(page)).toHaveCount(1);
  }
  finally {
    await context.close();
  }
});

/*
 * The admin panel says which role it is there through: the super-admin colour on a
 * roadmap of an org the admin has no role in, the manager one in the org they manage,
 * with or without their powers.
 */
test("the admin panel tells super-admin access from a manager's", async ({ browser, admin, sandbox }) => {
  test.setTimeout(180_000);
  const foreignRoadmapId = await createRoadmap(admin, await orgIdByName(admin, foreignName), { name: `Foreign ${sandbox.label}` });
  const context = await loginContext(browser, Seed.admin.username);
  const page = await context.newPage();
  try {
    const panel = page.getByTestId("admin-panel").filter({ visible: true });

    await page.goto(`/roadmap/${foreignRoadmapId}`);
    await expect(panel).toHaveAttribute("data-super-admin", "true");
    await expect(panel).toContainText("admin_panel_info_super_admin");

    // The sandbox roadmap belongs to the org admin manages
    await page.goto(`/roadmap/${sandbox.roadmapId}`);
    await expect(panel).toHaveAttribute("data-super-admin", "false");
    await expect(panel).not.toContainText("admin_panel_info_super_admin");

    const suspended = await context.request.post("/api/user/privileges", { data: { superAdmin: false } });
    expect(suspended.status(), `suspend -> ${await suspended.text()}`).toBe(200);
    await page.goto(`/roadmap/${sandbox.roadmapId}`);
    await expect(panel).toHaveAttribute("data-super-admin", "false");
  }
  finally {
    await context.close();
    await deleteRoadmap(admin, foreignRoadmapId);
  }
});
