import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import type { ViewportSize } from "playwright/test";
import path from 'path';
import { fileURLToPath } from 'url';
import { link } from "fs";
import { error, time } from "console";
import { escape } from "querystring";
import { text } from "stream/consumers";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const adminFile = path.join(__dirname, '../.auth/admin.json');

let sendFolderPath = "";// Denotes what folder the screenshots should be added to
let sendPageName = ""; // Denotes what a screenshot is of

async function takeScreenshot(pathFolder: string, pageName: string, page: Page, worker: string) {
    await isSidebarOpen(page, true);

    await page.screenshot({ path: `./tests/screenshots/${pathFolder}/${pageName}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `./tests/screenshots/${pathFolder}/${pageName}-${worker}-fullPage.jpeg`, fullPage: true, animations: "disabled" });
}

async function isSidebarOpen(page: Page, wantedClosed: boolean) { //Checks if the sidebar is open
    let isSidebarOpen = await page.getByTestId('language-switcher-dialog-button').boundingBox();
    if (wantedClosed) {
        if (isSidebarOpen === null) { }
        else if (isSidebarOpen.width > 100) {
            await page.getByRole('checkbox').first().click();
        }
    } else {
        if (isSidebarOpen === null) {
            await page.getByRole("checkbox").first().click();
        } else if (isSidebarOpen.width < 100) {
            await page.getByRole("checkbox").first().click();
        }
    }
}

test.describe('Screenshot tests', () => {

    test('Main page pics', async ({ page }, metadata) => {
        sendFolderPath = "mainPage"; // The folder the screenshots should be added to

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Main page
        await expect.soft(page.getByTestId('home-title')).toBeVisible();
        sendPageName = "mainPage"; // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
        await isSidebarOpen(page, false);
        await page.screenshot({ path: `./tests/screenshots/mainPage/mainPage-${metadata.project.name}-sidebar.jpeg`, fullPage: false, animations: "disabled" });
        await page.screenshot({ path: `./tests/screenshots/mainPage/mainPage-${metadata.project.name}-sidebar-fullPage.jpeg`, fullPage: true, animations: "disabled" });
    });

    async function sidebarTest(page: Page, openState: string, worker: string) {
        // Create menu popover
        await page.getByTestId('create-button').click();
        await expect.soft(page.getByTestId('create-roadmap-series')).toBeVisible();

        await page.screenshot({ path: `./tests/screenshots/sidebar/createMenuPopped-${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
        await page.screenshot({ path: `./tests/screenshots/sidebar/createMenuPopped-${openState}-${worker}-fullPage.jpeg`, fullPage: true, animations: "disabled" });
        await page.keyboard.press('Escape')

        // Language popover
        await page.getByTestId('language-switcher-dialog-button').click();
        await expect.soft(page.getByTestId('language-switcher-option-English')).toBeVisible();
        await page.screenshot({ path: `./tests/screenshots/sidebar/languageMenuPopped-${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
        await page.screenshot({ path: `./tests/screenshots/sidebar/languageMenuPopped-${openState}-${worker}-fullPage.jpeg`, fullPage: true, animations: "disabled" });
        await page.keyboard.press('Escape')

        // Settings popover
        await page.getByTestId('settings-button').click();
        await expect.soft(page.locator('#allowStorage')).toBeVisible();
        await page.screenshot({ path: `./tests/screenshots/sidebar/SettingsMenuPopped-${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
        await page.screenshot({ path: `./tests/screenshots/sidebar/SettingsMenuPopped-${openState}-${worker}-fullPage.jpeg`, fullPage: true, animations: "disabled" });
        await page.keyboard.press('Escape')
    }

    test('Sidebar pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        let tooSmallScreen = false;

        await isSidebarOpen(page, true)
        const sidebarStatus = await page.getByTestId('language-switcher-dialog-button').boundingBox();
        if (sidebarStatus === null) {
            tooSmallScreen = true;
        }
        await isSidebarOpen(page, false)

        // First runs sidebarTest with the sidebar open then closes it and runs the test again
        await sidebarTest(page, "open", metadata.project.name);
        if (!tooSmallScreen) {
            await isSidebarOpen(page, true);
            await sidebarTest(page, "closed", metadata.project.name);
        }
    });

    test('Account pics', async ({ page }, metadata) => {
        sendFolderPath = "Account" // The folder the screenshots should be added to

        // Create account page
        await page.goto('/signup');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createAccount" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Log in page
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#remember')).toBeVisible();
        sendPageName = "logIn" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

});

test.describe('Screenshots Admin', () => {
    test.use({ storageState: adminFile });

    test('Logged in sidebar pics', async ({ page }, metadata) => {
        sendFolderPath = "sidebar" // The folder the screenshots should be added to

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.getByTestId('home-title')).toBeVisible();
        sendPageName = "loggedIn" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

    test('My account pics', async ({ page }, metadata) => {
        sendFolderPath = "account" // The folder the screenshots should be added to

        // My account page
        await page.goto('/@admin');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.getByRole('heading', { name: 'admin' })).toBeVisible();
        sendPageName = "myAccount" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Roadmap Series pics', async ({ page }, metadata) => {
        sendFolderPath = "Roadmap" // The folder the screenshots should be added to

        // Roadmap Series create
        await page.goto('/metaRoadmap/create');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createSeries" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap Series 
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

        await page.getByTestId('show-roadmap-series').click();
        await page.waitForLoadState('networkidle');

        // await page.getByRole('heading', { name: 'roadmap_versions' }).hover();
        await expect.soft(page.getByRole('heading', { name: 'roadmap_versions' })).toBeVisible();
        sendPageName = "roadmapSeries" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap Series Edit
        await page.getByTestId('admin-panel-edit').click();
        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "editRoadmapSeries" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Roadmap pics', async ({ page }, metadata) => {
        sendFolderPath = "Roadmap" // The folder the screenshots should be added to

        // Roadmap create
        await page.goto('/roadmap/create');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createRoadmap" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan" }).click();

        await expect.soft(page.getByRole('heading', { name: "Rikets färdplan" })).toBeVisible();
        sendPageName = "roadmap" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap Edit
        await page.getByTestId('admin-panel-edit').click();

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "editRoadmap" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });


    test('Goal pics', async ({ page }, metadata) => {
        sendFolderPath = "Goal" // The folder the screenshots should be added to

        // Create
        await page.goto('/goal/create');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createGoal" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Goal
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

        const URL = await page.url();
        let i = 0;

        while (URL === await page.url()) { // Loop to open all of the tree items to find a goal
            try {
                await page.getByRole('listitem').nth(i).click();
                i++;
            } catch {
                if (await page.locator('#select-graphType').isVisible()) {
                    break;
                } else {
                    // How do you throw an error good?
                    expect(page.getByTestId('home-title')).toBeVisible(); // Needed it to throw an error and stop the test but didn't know a good way to do that
                }
            }
        }

        await expect.soft(page.locator('#select-graphType')).toBeVisible();
        sendPageName = "goal" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        await page.getByTestId('admin-panel-edit').click();

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "editGoal" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

    test('Action pics', async ({ page }, metadata) => {
        sendFolderPath = "Action" // The folder the screenshots should be added to

        // Create
        await page.goto('/action/create');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createAction" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        await page.goto('/actions')
        await page.waitForLoadState('networkidle');

        await expect.soft(page.getByRole('heading').first()).toBeVisible();
        sendPageName = "actionsPage" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Effect', async ({ page }, metadata) => {
        sendFolderPath = "Effect" // The folder the screenshots should be added to

        // Create
        await page.goto('/effect/create');
        await page.waitForLoadState('networkidle');

        await expect.soft(page.locator('#submit-button')).toBeVisible();
        sendPageName = "createEffect" // What the screenshot is of
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

});
