import { localeAliases, Locales } from "../../i18n.config";
import { switchLanguage } from "../lib/switch-language";
import { expect, test } from "playwright/test";

test.describe("Sidebar tests", () => {
  test("Language switcher initial language", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open dialog
    const dialogButton = page.getByTestId("language-switcher-dialog-button");
    await expect(dialogButton, "Language switcher dialog is not visible").toBeVisible();
    await dialogButton.click();

    const optionsUL = page.getByTestId("language-switcher-options");
    await optionsUL.waitFor({ state: "visible" });
    await expect(optionsUL, "Language switcher options are not visible").toBeVisible();

    // Find the checked element
    const checkedElement = optionsUL.locator("li button[data-checked='true']").first();
    // Test browsers have accept-language set to "cimode", check that this is the default selected language
    await expect(checkedElement, "Default language is not cimode").toHaveText(localeAliases[Locales.test]);
  });

  test("Language switcher correct aliases", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const languageSwitcher = page.getByTestId("language-switcher");

    const allOptions = (await languageSwitcher.locator("option").allTextContents()).map((option) => option.toLowerCase());
    const allAliases = Object.values(localeAliases).map((alias) => alias.toLowerCase());

    expect(allOptions.every(option => allAliases.includes(option)), "Language switcher options do not match expected aliases").toBe(true);
  });

  test("Language switcher changes language", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const homeTitle = page.getByTestId("home-title");

    await expect(homeTitle, "Page is not in cimode").toHaveText("home.title");

    await switchLanguage(page, localeAliases[Locales.enSE]);

    await page.waitForLoadState("networkidle");

    await expect(homeTitle, "Page is not in English").toHaveText("Roadmaps");

    await switchLanguage(page, localeAliases[Locales.svSE]);

    // TODO: remove extra waitForLoadState now that the expect is awaited instead?
    await page.waitForLoadState("networkidle");

    await expect(homeTitle, "Page is not in Swedish").toHaveText("Färdplaner");
  });
});