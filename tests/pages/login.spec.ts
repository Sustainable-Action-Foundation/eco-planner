import { localeAliases } from "../i18nTestVariables";
import { switchLanguage } from "../lib/switch-language";
import { expect, test } from "playwright/test";

test("Login functionality", async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState("networkidle");
    
    const login = async () => {
      await page.getByTestId("login-button").click();

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

      await expect(page).toHaveURL('/');
    };

    const logout = async () => {
      await page.getByTestId("logout-button").click();
      await expect(page.getByTestId("login-button")).toBeVisible();
    };

    // Change language to English
    await switchLanguage(page, localeAliases["en-SE"])

    // English locale
    await login();
    await logout();

    // Change language to Swedish
    await switchLanguage(page, localeAliases["sv-SE"])

    // Swedish locale
    await login();
    await logout();
  });