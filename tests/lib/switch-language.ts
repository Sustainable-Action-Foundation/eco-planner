import { uniqueLocales } from "i18nTestVariables";
import { expect, Page } from "playwright/test";

export async function switchLanguage(page: Page, languageAlias: string) {
  const wrapper = page.getByTestId("language-switcher-dialog-wrapper");
  await expect(wrapper, "Language switcher dialog is not visible").toBeVisible();

  // Open dialog
  await wrapper
    .locator("button").first()
    .click();

  // Wait for the language options
  const options = page.getByTestId("language-switcher-options");
  await options.waitFor({ state: "visible" });
  await expect(options, "Language switcher options are not visible").toBeVisible();

  // Check that the language count is correct
  const optionCount = await options.locator("li").count();
  expect(optionCount, `Language switcher options count is not ${uniqueLocales.length}`).toBe(uniqueLocales.length);

  // Select the language option
  const option = page.getByTestId(`language-switcher-option-${languageAlias}`);
  await expect(option, `Language switcher option for ${languageAlias} is not visible`).toBeVisible();
  await option.click();

  // TODO - Remove this and just fix the darned rerendering 
  // Extra little wait to ensure the page has time to reload 
  await page.waitForTimeout(1000);
}