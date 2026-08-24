import { expect, test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

const orgName = "Sustainable Action";

test.describe("Org landing page (multi-org manager)", () => {
  test.use({ storageState: adminFile });

  test("The switcher lists every org for a super admin plus the public view", async ({ page }) => {
    await page.goto("/");
    // admin is a super admin: Sustainable Action + two extra orgs (random names)
    // they are a member of + the extra org they are NOT a member of + the public tab
    const tabs = page.locator('nav[aria-label*="org_nav_label"]').getByRole("link");
    await expect(tabs).toHaveCount(5);
    await expect(tabs.filter({ hasText: orgName })).toBeVisible();
    await expect(tabs.filter({ hasText: "home.public_tab" })).toBeVisible();
  });

  test("A super admin can traverse an org they are not a member of", async ({ page }) => {
    await page.goto("/");
    // Memberships come first, so the last org tab is the one admin has no membership in
    const orgTabs = page.locator('nav[aria-label*="org_nav_label"]').getByRole("link").filter({ hasNotText: "home.public_tab" });
    const lastTab = orgTabs.last();
    const name = (await lastTab.textContent())?.trim() ?? "";
    await lastTab.click();

    await expect(page.getByTestId("home-title")).toHaveText(name);
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
    const orgHref = await page.locator('nav[aria-label*="org_nav_label"]').getByRole("link", { name: orgName }).getAttribute("href");
    await page.goto(orgHref ?? "/");

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
    const orgHref = await page.locator('nav[aria-label*="org_nav_label"]').getByRole("link", { name: orgName }).getAttribute("href");
    await page.goto(`${orgHref}&searchFilter=${encodeURIComponent("Rikets färdplan")}`);
    await expect(page.getByRole("link", { name: /Rikets färdplan/ }).first()).toBeVisible();
  });
});

test.describe("Org landing page (single-org member)", () => {
  test.use({ storageState: verifiedFile });

  test("A member of one org lands straight on its page, without the manager link", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toHaveText(orgName);
    // One org tab + the public tab
    await expect(page.locator('nav[aria-label*="org_nav_label"]').getByRole("link")).toHaveCount(2);
    await expect(page.getByRole("link", { name: "org_groups.manage_groups" })).toHaveCount(0);
  });
});

test.describe("Org landing page (logged out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Anonymous visitors get the public view without a switcher", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toHaveText("home.title");
    await expect(page.locator('nav[aria-label*="org_nav_label"]')).toHaveCount(0);
  });
});
