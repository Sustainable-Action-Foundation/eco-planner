import { Page } from "playwright/test";

export async function switchLanguage(page: Page, language: string) {
  const languageSwitcher = page.getByTestId("language-switcher");
  languageSwitcher.selectOption(language)
  await page.waitForTimeout(1000);
}