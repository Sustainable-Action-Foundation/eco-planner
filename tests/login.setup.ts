import { test as setup, expect } from "playwright/test";
import type { Page } from "playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { loginAs, Seed } from "./lib/api";

/*
 * Stored sessions for the browser projects. Logins go through the test-only
 * /api/test/login (TEST_ENVIRONMENT=testing): the real login is a mailed link
 * whose per-address throttle would not survive a suite that signs in as the same
 * few users over and over. The link flow itself is covered by e2e/auth.spec.ts
 * and api/login-link.spec.ts.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");
const guestFile = path.join(cwd(), "tests/.auth/guest.json");

async function loginHelper(page: Page, username: string) {
  // The browser context and its request context share a cookie jar
  await loginAs(page.request, username);
  await page.goto("/");

  // Logout button replaces the login button in the sidebar when logged in
  // Generous: under parallel load the first post-login render of the start page can take a while
  await expect(page.getByTestId("logout-button")).toBeVisible({ timeout: 15_000 });
}

async function saveState(page: Page, file: string, label: string) {
  console.info(`Saving ${label} storageState to`, file);
  try {
    await page.context().storageState({ path: file });
    console.info(`Saved ${label} storageState, exists=`, existsSync(file));
    if (existsSync(file)) {
      console.info(`${path.basename(file)} size=`, readFileSync(file, "utf8").length);
    }
  }
  catch (err) {
    console.error(`Failed to save ${label} storageState:`, err);
    throw err;
  }
}

setup('authenticate as admin', async ({ page }) => {
  await loginHelper(page, Seed.admin.username);
  await saveState(page, adminFile, "admin");
});

setup('authenticate as verified user', async ({ page }) => {
  await loginHelper(page, Seed.anita.username);
  await saveState(page, verifiedFile, "verified");
});

setup('authenticate as guest user', async ({ page }) => {
  // Greta can log in like any member; being a GUEST only affects access
  await loginHelper(page, Seed.greta.username);
  await saveState(page, guestFile, "guest");
});

setup('an unknown user cannot be logged in', async ({ page }) => {
  const response = await page.request.post("/api/test/login", { data: { username: "badUser" } });
  expect(response.status()).toBe(404);
});
