import { expect, Page } from "playwright/test";

export async function switchLanguage(page: Page, languageAlias: string) {
  const wrapper = page.getByTestId("language-switcher-dialog-wrapper");
  await expect(wrapper, "Language switcher dialog is not visible").toBeVisible();

  // Open dialog
  await wrapper
    .locator("button").first()
    .click();

  const options = wrapper.getByTestId("language-switcher-options");
  await options.waitFor({ state: "visible" });
  await expect(options, "Language switcher options are not visible").toBeVisible();

  // Select the language option
  const option = options.getByTestId(`language-switcher-option-${languageAlias}`);
  await expect(option, `Language switcher option for ${languageAlias} is not visible`).toBeVisible();
  await option.click();

  // Extra little wait to ensure the page has time to reload
  await page.waitForTimeout(1000);
}