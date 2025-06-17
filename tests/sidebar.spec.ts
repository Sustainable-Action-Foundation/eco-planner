import "./lib/console";
import { localeAliases, Locales } from "i18nTestVariables";
import { switchLanguage } from "lib/switch-language";
import { expect, test } from "playwright/test";

test.describe("Sidebar tests", () => {
  test("Language switcher initial language", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const languageSwitcher = page.getByTestId("language-switcher");
    const options = await languageSwitcher.locator("option").allTextContents();
    const initialLanguage = options.at(0);

    // Test browsers have accept-language set to Swedish
    expect(initialLanguage).toBe(localeAliases[Locales.svSE]);
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

    const initialTitle = await homeTitle.textContent();
    expect(initialTitle, "Page is not in Swedish").toBe("Färdplaner")

    await switchLanguage(page, localeAliases[Locales.enSE]);

    const englishTitle = await homeTitle.textContent();
    expect(englishTitle, "Page is not in English").toBe("Roadmaps")

    await switchLanguage(page, localeAliases[Locales.svSE]);

    const swedishTitle = await homeTitle.textContent();
    expect(swedishTitle, "Page is not in Swedish").toBe("Färdplaner")
  });
});