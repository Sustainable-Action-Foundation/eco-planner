import type { Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { loginContext, orgIdByName, Seed } from "../lib/api";
import { visible } from "../lib/forms";
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

/** The foreign org's entry in the start page's switcher (chip or select option) */
function foreignEntry(page: Page, orgId: string): Locator {
  return visible(page, "main nav").locator(`a[href="/?org=${orgId}"], option[value="${orgId}"]`);
}

test("super admin toggles their powers off and back on", async ({ browser, admin }) => {
  test.setTimeout(180_000);
  const orgId = await orgIdByName(admin, foreignOrg.name);
  const context = await loginContext(browser, Seed.admin.username);
  const page = await context.newPage();
  try {
    const toggle = page.getByTestId("super-admin-toggle").filter({ visible: true });
    const indicator = page.getByTestId("super-admin-suspended").filter({ visible: true });

    await page.goto("/");
    await expect(foreignEntry(page, orgId)).toHaveCount(1);
    await expect(indicator).toHaveCount(0);

    await page.goto(`/@${Seed.admin.username}`);
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(indicator).toBeVisible();

    await page.goto("/");
    await expect(visible(page, "main nav").locator('a[href="/?org=public"], option[value="public"]').first()).toBeAttached();
    await expect(foreignEntry(page, orgId)).toHaveCount(0);
    await expect(indicator).toBeVisible();

    await page.goto(`/@${Seed.admin.username}`);
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(indicator).toHaveCount(0);

    await page.goto("/");
    await expect(foreignEntry(page, orgId)).toHaveCount(1);
  }
  finally {
    await context.close();
  }
});
