import { localeAliases } from "../i18nTestVariables";
import { switchLanguage } from "../lib/switch-language";
import { expect, test } from "playwright/test";


test.describe("Locales Test page", () => {
  const keyCountThreshold = 400;
  const emptyMessage = "[EMPTY]";
  const missingMessage = "[MISSING]";

  test("Formatters", async ({ page }) => {
    await page.goto("/localesTest");
    await page.waitForLoadState("networkidle");

    const table = page.getByTestId("formatter-table");
    const rows = table.getByTestId("formatter-row");

    for (let i = 0; i < await rows.count(); i++) {
      const row = rows.nth(i);
      const output = await row.getByTestId("output").textContent();
      const input = await row.getByTestId("input").textContent();

      expect(output !== input, `Formatter (row ${i + 1}) failed to transform`).toBeTruthy();
    }
  });

  test("Key count", async ({ page }) => {
    await page.goto("/localesTest");
    await page.waitForLoadState("networkidle");

    const checkKeyCount = async () => {
      const table = page.getByTestId("translation-table");
      const rows = table.getByTestId("translation-row");

      const rowCount = await rows.count();
      const serverCount = await table.getByTestId("server").count();
      const clientCount = await table.getByTestId("client").count();

      expect(rowCount, `There are fewer rows than expected with initial local. Current threshold is ${keyCountThreshold}`).toBeGreaterThan(keyCountThreshold);
      expect(serverCount, "Server and client columns are not equal").toEqual(clientCount);
    };

    // Initial locale
    await checkKeyCount();

    // Change language to English
    await switchLanguage(page, localeAliases["en-SE"])

    // English locale
    await checkKeyCount();

    // Change language to Swedish
    await switchLanguage(page, localeAliases["sv-SE"])

    // Swedish locale
    await checkKeyCount();
  });

  test("Empty or missing translations", async ({ page }) => {
    await page.goto("/localesTest");
    await page.waitForLoadState("networkidle");

    const checkEmptyAndMissing = async () => {
      const table = page.getByTestId("translation-table");

      const serverEntries = await table.getByTestId("server").allTextContents();
      const clientEntries = await table.getByTestId("client").allTextContents();

      const emptyServer = serverEntries.filter((entry) => entry === emptyMessage).length;
      const missingServer = serverEntries.filter((entry) => entry === missingMessage).length;
      const emptyClient = clientEntries.filter((entry) => entry === emptyMessage).length;
      const missingClient = clientEntries.filter((entry) => entry === missingMessage).length;

      expect(emptyServer, "There are empty translations on the server side").toEqual(0);
      expect(missingServer, "There are missing translations on the server side").toEqual(0);
      expect(emptyClient, "There are empty translations on the client side").toEqual(0);
      expect(missingClient, "There are missing translations on the client side").toEqual(0);
    };

    // Initial locale
    await checkEmptyAndMissing();

    // Change language to English
    await switchLanguage(page, localeAliases["en-SE"])

    // English locale
    await checkEmptyAndMissing();

    // Change language to Swedish
    await switchLanguage(page, localeAliases["sv-SE"])

    // Swedish locale
    await checkEmptyAndMissing();
  });
    test("Check login functionality", async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState("networkidle");
    
    const login = async () => {
      await page.getByTestId("create-menu-popover").click();
      await page.getByTestId("create-roadmap-series-link").click();
      await page.getByTestId("close-create-menu-popover").click();

      const userInput = page.getByTestId("username-input");
      const passwordInput = page.getByTestId("password-input");

      await userInput.click();
      await userInput.fill('admin');
      await passwordInput.click();
      await passwordInput.fill('admin');
      
      const submitButton = await page.getByTestId("login-submit-button");

      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // const storage = await page.evaluate(() => localStorage.getItem('token'));
      // console.log(storage);

      // await page.waitForUrl('/dashboard', {waitUntil: 'networkidle'})

      await expect(page.getByTestId("name-input")).toBeVisible();

      await page.getByTestId("logout-button").click();

      await expect(page.getByTestId("create-menu-popover")).toBeVisible();
    };

    // Change language to English
    await switchLanguage(page, localeAliases["en-SE"])

    // English locale
    await login();

    // Change language to Swedish
    await switchLanguage(page, localeAliases["sv-SE"])

    // Swedish locale
    await login();
  });
});