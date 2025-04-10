import { expect, test } from "playwright/test";

test.describe("Locales Test page", () => {
  test("Key count", async ({ page }) => {
    await page.goto("/localesTest");
  });
});