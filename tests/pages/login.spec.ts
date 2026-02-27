import { expect, test } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const verifiedFile = path.join(__dirname, '../.auth/verified.json');

test('Login as unverified user', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('anton');
    await page.locator('#password').fill('anton');
    await page.locator('#submit-button').click();

    page.once('dialog', async dialog => {
        await dialog.accept();
    });

    await expect(page.locator('#username')).toBeVisible();
});

// This describe block is needed to use "test.use ({ storageState: verifiedFile });" for only the logout test, without affecting the login test above.
test.describe("Logout tests", () => {
	test.use ({ storageState: verifiedFile });

	test('Logout as verified user', async ({ page }) => {     
		const LOGIN_COOKIE_NAME = 'eco_planner';
		
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		
		const loginCookies = await page.context().cookies();
		const loginCookie = loginCookies.find(c => c.name === LOGIN_COOKIE_NAME);
		expect(loginCookie, `Expected "${LOGIN_COOKIE_NAME}" cookie to exist after login`).toBeDefined();
		
		await page.getByTestId('logout-button').click();
		await expect(page.getByTestId("home-title")).toBeVisible();

		// Poll until the cookie is removed rather than checking once
		await expect.poll(async () => {
			const cookies = await page.context().cookies();
			return cookies.find(c => c.name === LOGIN_COOKIE_NAME);
		}, {
			message: `Expected "${LOGIN_COOKIE_NAME}" cookie to be removed after logout`,
			timeout: 3000,
		}).toBeUndefined();
	});
});
