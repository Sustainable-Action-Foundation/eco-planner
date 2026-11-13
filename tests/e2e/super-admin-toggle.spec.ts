import type { Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { loginContext, Seed } from "../lib/api";
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
