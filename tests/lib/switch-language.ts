import { Page } from "playwright/test";

export async function switchLanguage(page: Page, languageAlias: string) {
  const languageSwitcher = page.getByTestId("language-switcher");
  languageSwitcher.selectOption(languageAlias)
  await page.waitForTimeout(1000);
}