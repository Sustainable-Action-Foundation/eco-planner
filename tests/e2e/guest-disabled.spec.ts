import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { seedPlaces } from "../../scripts/prisma/seed/places";
import { Seed } from "../lib/api";
import { orgSwitcher } from "../lib/org-switcher";
import { visible } from "../lib/forms";

/*
 * Guests are DISABLED until further notice: a GUEST membership must grant
 * nothing. Greta is the seeded canary, a GUEST of "Sustainable Action" and a
 * member of its group, which holds an RW grant on the public national roadmap
 * and an RO grant on the org-shared regional one. anita, a plain member in the
 * same group, is the positive control: what she sees, Greta must not. When
 * guests come back, replace this suite with positive coverage.
 * (The invite page 404 is in smoke.spec.ts, the guest APIs in tests/api.)
 */

const guestFile = path.join(cwd(), "tests/.auth/guest.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

/** Org-shared roadmaps whose names contain "Uppsala": the regional one (RO grant to Greta's group) and Uppsala kommun's */
const orgSharedUppsala = [Seed.regionalRoadmap, ...seedPlaces.filter(place => place.sharing === "ORG" && place.name.includes("Uppsala")).map(place => place.roadmapName)];

/** The roadmap links of the visible start page */
function roadmapLinks(page: Page, name: string | RegExp) {
  return visible(page, "main").locator('a[href^="/roadmap/"]').filter({ hasText: name });
}

/** Opens the national roadmap's latest version through the public start page's search */
async function openNationalRoadmap(page: Page) {
  await page.goto(`/?org=public&searchFilter=${encodeURIComponent(Seed.nationalRoadmap)}`);
  const link = roadmapLinks(page, Seed.nationalRoadmap).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/roadmap\/[0-9a-f-]+\/v\d+$/, { timeout: 30_000 });
  await expect(page.getByTestId("show-roadmap").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
}

test.describe("Guests are disabled", () => {
  test.use({ storageState: guestFile });

  test("a guest gets the public start page without the org switcher", async ({ page }) => {
    await page.goto("/");
    // The roadmap search and the image hero only exist on the public view (an org landing has neither)
    await expect(visible(page, "#roadmap-search-title")).toBeVisible();
    await expect(visible(page, "main img").first()).toBeVisible();
    await expect(orgSwitcher(page)).toHaveCount(0);
  });

  test("org-shared roadmaps stay hidden despite the group's RO grant", async ({ page }) => {
    await page.goto(`/?searchFilter=${encodeURIComponent("Uppsala")}`);
    await expect(page.getByTestId("home-title").filter({ visible: true })).toBeVisible();
    // The search ran on the public view
    await expect(visible(page, "#roadmap-search-title")).toBeVisible();
    for (const name of orgSharedUppsala) {
      await expect(roadmapLinks(page, name)).toHaveCount(0);
    }
  });

  test("the group's RW grant confers no edit controls on public content", async ({ page }) => {
    await openNationalRoadmap(page);
    await expect(page.getByTestId("admin-panel-edit")).toHaveCount(0);
    await expect(page.getByTestId("admin-panel-new-action")).toHaveCount(0);
  });
});

test.describe("Guest canary controls", () => {
  test.use({ storageState: verifiedFile });

  test("a member of the same group sees the org-shared roadmap and the edit controls", async ({ page }) => {
    await page.goto(`/?org=public&searchFilter=${encodeURIComponent(Seed.regionalRoadmap)}`);
    await expect(roadmapLinks(page, Seed.regionalRoadmap).first()).toBeVisible();

    await openNationalRoadmap(page);
    await expect(page.getByTestId("admin-panel-edit").filter({ visible: true })).toBeVisible();
  });
});
