import "./lib/console";
import { expect, test } from "playwright/test";


test.describe("Locales Test page", () => {

  const keyCountThreshold = 400;
  const emptyMessage = "[EMPTY]";
  const missingMessage = "[MISSING]";

  test("Key count", async ({ page }) => {
    await page.goto("/localesTest");

    await page.waitForSelector("[data-testid='translation-table']");
    await page.waitForSelector("[data-testid='row']");
    
    const table = await page.getByTestId("translation-table");
    const rows = await table.getByTestId("row");

    const rowCount = await rows.count();

    expect(rowCount, `There are fewer rows than expected. Current threshold is ${keyCountThreshold}`).toBeGreaterThan(keyCountThreshold);
  });

  test("Empty or missing translations", async ({ page }) => {
    await page.goto("/localesTest");

    await page.waitForSelector("[data-testid='translation-table']");
    await page.waitForSelector("[data-testid='row']");

    const table = await page.getByTestId("translation-table");
    const rows = await table.getByTestId("row");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = await rows.nth(i);
      const key = await row.getByTestId("key").textContent();
      const server = await row.getByTestId("server").textContent();
      const client = await row.getByTestId("client").textContent();

      // Null checks
      expect(key, `Null key found on row ${i + 1}`).not.toBeNull();
      expect(server, `Null server translation found for key ${key} on row ${i + 1}`).not.toBeNull();
      expect(client, `Null client translation found for key ${key} on row ${i + 1}`).not.toBeNull();

      // Empty checks
      expect(server, `Empty server translation found for key ${key} on row ${i + 1}`).not.toEqual(emptyMessage);
      expect(client, `Empty client translation found for key ${key} on row ${i + 1}`).not.toEqual(emptyMessage);

      // Missing checks
      expect(server, `Missing server translation found for key ${key} on row ${i + 1}`).not.toEqual(missingMessage);
      expect(client, `Missing client translation found for key ${key} on row ${i + 1}`).not.toEqual(missingMessage);
    }
  });
});