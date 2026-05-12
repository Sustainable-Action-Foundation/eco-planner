import { expect, test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");
test.use({ storageState: verifiedFile });

test("Logout as verified user", async ({ page }) => {
  const LOGIN_COOKIE_NAME = "eco_planner";

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const loginCookies = await page.context().cookies();
  const loginCookie = loginCookies.find(c => c.name === LOGIN_COOKIE_NAME);
  expect(loginCookie, `Expected "${LOGIN_COOKIE_NAME}" cookie to exist after login`).toBeDefined();

  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("home-title")).toBeVisible();

  // Poll until the cookie is removed rather than checking once
  await expect.poll(async () => {
    const cookies = await page.context().cookies();
    return cookies.find(c => c.name === LOGIN_COOKIE_NAME);
  }, {
    message: `Expected "${LOGIN_COOKIE_NAME}" cookie to be removed after logout`,
    timeout: 3000,
  }).toBeUndefined();
});
