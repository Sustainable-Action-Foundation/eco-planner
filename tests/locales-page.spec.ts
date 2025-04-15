import { switchLanguage } from "lib/switch-language";
import "./lib/console";
import { expect, test } from "playwright/test";


test.describe("Locales Test page", () => {

  const keyCountThreshold = 400;
  const emptyMessage = "[EMPTY]";
  const missingMessage = "[MISSING]";

  test("Key count", async ({ page }) => {
    await page.goto("/localesTest");

    const checkKeyCount = async () => {
      await page.waitForSelector("[data-testid='translation-table']");
      await page.waitForSelector("[data-testid='row']");

      const table = page.getByTestId("translation-table");
      const rows = table.getByTestId("row");

      const rowCount = await rows.count();
      const serverCount = await table.getByTestId("server").count();
      const clientCount = await table.getByTestId("client").count();

      expect(rowCount, `There are fewer rows than expected with initial local. Current threshold is ${keyCountThreshold}`).toBeGreaterThan(keyCountThreshold);
      expect(serverCount, "Server and client columns are not equal").toEqual(clientCount);
    };

    // Initial locale
    await checkKeyCount();

    // Change language to English
    await switchLanguage(page, "English")

    // English locale
    await checkKeyCount();

    // Change language to Swedish
    await switchLanguage(page, "Svenska")

    // Swedish locale
    await checkKeyCount();
  });

  test("Empty or missing translations", async ({ page }) => {
    await page.goto("/localesTest");

    const checkEmptyAndMissing = async () => {
      await page.waitForSelector("[data-testid='translation-table']");
      await page.waitForSelector("[data-testid='row']");

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
    await switchLanguage(page, "English")

    // English locale
    await checkEmptyAndMissing();

    // Change language to Swedish
    await switchLanguage(page, "Svenska")

    // Swedish locale
    await checkEmptyAndMissing();
  });
});