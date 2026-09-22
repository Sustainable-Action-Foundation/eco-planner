import { expect, test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";
import { orgLandingHref, orgSwitcher } from "../lib/org-switcher";
import { seedPlaces } from "../../scripts/prisma/seed/places";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

const orgName = "Sustainable Action";

test.describe("Org landing page (multi-org manager)", () => {
  test.use({ storageState: adminFile });

  test("The switcher is a select listing every org for a super admin plus the public view", async ({ page }) => {
    await page.goto("/");
    // admin is a super admin: Sustainable Action + every seeded place (member
    // of some, not of others) + the public view: past the chip limit, so a
    // select rather than a row of chips
    // The switcher streams in with the dynamic content; wait for it to render before counting
    await orgSwitcher(page).locator("select, a").first().waitFor({ timeout: 15_000 });
    await expect(orgSwitcher(page).getByRole("link")).toHaveCount(0);
    const options = orgSwitcher(page).locator("select option");
    await expect(options).toHaveCount(1 + seedPlaces.length + 1);
    await expect(options.filter({ hasText: orgName })).toHaveCount(1);
    await expect(options.last()).toHaveText("home.public_tab");
  });

  test("A super admin can traverse an org they are not a member of", async ({ page }) => {
    await page.goto("/");
    // Memberships come first, so the last org option (before the public one) is the one admin has no membership in
    const select = orgSwitcher(page).locator("select");
    const lastOrg = select.locator("option").nth(-2);
    const name = (await lastOrg.textContent())?.trim() ?? "";
    await select.selectOption({ label: name });

    await expect(page.getByTestId("home-title")).toHaveText(name);
    await expect(select).toHaveValue(new URL(page.url()).searchParams.get("org") ?? "");
    // Super admins manage every org
    await expect(page.getByRole("link", { name: "org_groups.manage_groups" })).toBeVisible();
  });

  test("The default view is an org landing, not the public page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toBeVisible();
    // Org landings use the solid hero (no attributed image) and their own name as title
    await expect(page.getByTestId("home-title")).not.toHaveText("home.title");
    await expect(page.locator("main img")).toHaveCount(0);
  });

  test("An org's landing shows its readable roadmaps, actions, and the manager link", async ({ page }) => {
    await page.goto("/");
    await page.goto(await orgLandingHref(page, orgName));

    await expect(page.getByTestId("home-title")).toHaveText(orgName);
    await expect(page.getByRole("link", { name: /Rikets färdplan/ }).first()).toBeVisible();
    // The actions browser renders with its search heading
    await expect(page.locator("#search-title")).toBeVisible();
    // admin manages this org
    await expect(page.getByRole("link", { name: "org_groups.manage_groups" })).toBeVisible();
  });

  test("The public tab restores the public view", async ({ page }) => {
    await page.goto("/?org=public");
    await expect(page.getByTestId("home-title")).toHaveText("home.title");
    await expect(page.locator("main img").first()).toBeVisible();
  });

  test("Search deep links keep working on an org landing", async ({ page }) => {
    await page.goto("/");
    await page.goto(`${await orgLandingHref(page, orgName)}&searchFilter=${encodeURIComponent("Rikets färdplan")}`);
    await expect(page.getByRole("link", { name: /Rikets färdplan/ }).first()).toBeVisible();
  });
});

test.describe("Org landing page (single-org member)", () => {
  test.use({ storageState: verifiedFile });

  test("A member of one org lands straight on its page, without the manager link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toHaveText(orgName);
    // One org chip + the public chip, no select
    await expect(orgSwitcher(page).getByRole("link")).toHaveCount(2);
    await expect(orgSwitcher(page).locator("select")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "org_groups.manage_groups" })).toHaveCount(0);
  });
});

test.describe("Org landing page (logged out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Anonymous visitors get the public view without a switcher", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toHaveText("home.title");
    await expect(orgSwitcher(page)).toHaveCount(0);
  });
});
