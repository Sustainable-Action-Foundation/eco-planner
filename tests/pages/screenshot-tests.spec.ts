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

let sendFolderPath = "";
let sendPageName = "";

async function takeScreenshot(pathFolder: string, pageName: string, page: Page, worker: string) {

    let isSidebarOpen = await page.getByTestId('language-switcher-dialog-button').boundingBox();
    if (isSidebarOpen === null) {
        await page.getByRole("checkbox").first().click();
    } else if (isSidebarOpen.width < 100) {
        await page.getByRole("checkbox").first().click();
    }

    await page.screenshot({ path: `./tests/screenshots/${pathFolder}/${pageName}-${worker}-sidebar.png`, fullPage: true, animations: "disabled" });
    await page.getByRole("checkbox").first().click();
    await page.screenshot({ path: `./tests/screenshots/${pathFolder}/${pageName}-${worker}-noSidebar.png`, fullPage: true, animations: "disabled" });
}

test.describe('Screenshot tests', () => {

    test('Main page pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Main page
        sendFolderPath = "mainPage"
        sendPageName = "mainPage"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name)
    });

    async function sidebarTest(page: Page, openState: string, worker: string) {
        // Create menu popover
        await page.getByTestId('create-button').click();
        await page.screenshot({ path: `./tests/screenshots/sidebar/createMenuPopped-${openState}-${worker}.png`, fullPage: true, animations: "disabled" });
        await page.getByTestId('home-title').click();

        // Language popover
        await page.getByTestId('language-switcher-dialog-button').click();
        await page.screenshot({ path: `./tests/screenshots/sidebar/languageMenuPopped-${openState}-${worker}.png`, fullPage: true, animations: "disabled" });
        await page.getByTestId('home-title').click();

        // Settings popover
        await page.getByRole('button').nth(2).click();
        await page.screenshot({ path: `./tests/screenshots/sidebar/SettingsMenuPopped-${openState}-${worker}.png`, fullPage: true, animations: "disabled" });
        await page.getByTestId('home-title').click();
    }


    test('Sidebar pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        let isSidebarOpen = await page.getByTestId('language-switcher-dialog-button').boundingBox();
        if (isSidebarOpen === null) {
            await page.getByRole("checkbox").first().click();
        } else if (isSidebarOpen.width < 100) {
            await page.getByRole("checkbox").first().click();
        }

        // First runs sidebarTest with the sidebar open then closes it and runs the test again
        await sidebarTest(page, "open", metadata.project.name);
        await page.getByRole("checkbox").first().click();
        await sidebarTest(page, "closed", metadata.project.name);

    });

    test('Account pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Create account page
        await page.getByRole('link').first().click();
        await page.locator('#submit-button').hover(); // "networkidle" isn't great so we are hovering to wait for load state where needed 

        sendFolderPath = "account"
        sendPageName = "createAccount"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name)

        // Log in page
        await page.getByRole('link').nth(4).click();
        await page.locator('#remember').hover();

        sendFolderPath = "account"
        sendPageName = "logIn"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

});

test.describe('Screenshots Admin', () => {
    test.use({ storageState: adminFile });

    test('Logged in sidebar pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        sendFolderPath = "sidebar"
        sendPageName = "loggedIn"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

    test('My account pics', async ({ page }, metadata) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // My account page
        await page.getByRole('link').first().click();
        await page.locator('#allowStorage').hover();
        await page.locator('#allowStorage').hover();

        sendFolderPath = "account"
        sendPageName = "myAccount"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Roadmap Series pics', async ({ page }, metadata) => {
        // Roadmap Series create
        await page.goto('/metaRoadmap/create');
        await page.waitForLoadState('networkidle');

        sendFolderPath = "Roadmap"
        sendPageName = "createSeries"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap Series 
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

        await page.getByTestId('show-roadmap-series').click();
        await page.waitForLoadState('networkidle');

        sendPageName = "roadmapSeries"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);


        // Roadmap Series Edit
        await page.getByTestId('admin-panel-edit').click();
        await page.locator('#submit-button').hover();

        sendPageName = "editRoadmapSeries"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Roadmap pics', async ({ page }, metadata) => {
        // Roadmap create
        await page.goto('/roadmap/create');
        await page.waitForLoadState('networkidle');

        sendFolderPath = "Roadmap"
        sendPageName = "createRoadmap"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
        await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

        sendPageName = "roadmap"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        for (let i = 0; i > 5; i++) {
            await page.getByRole('listitem').nth(i).click();
        }

        sendPageName = "roadmap-goalsOpen"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        // Roadmap Edit
        await page.getByTestId('admin-panel-edit').click();
        await page.locator('#submit-button').hover();

        sendPageName = "editRoadmap"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });


    test('Goal pics', async ({ page }, metadata) => {
        // Create
        await page.goto('/goal/create');
        await page.locator('#submit-button').hover(); // Webkit is weird and "networkidle" just gave a blank screenshot

        sendFolderPath = "Goal"
        sendPageName = "createGoal"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);


        // Goal
        await page.goto('/');
        await page.waitForLoadState("networkidle");

        await page.getByRole('link', { name: "Rikets färdplan (v2)" }).click();
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
                    page.getByTestId('home-title').hover(); // Needed it to throw an error and stop the test but didn't know a good way to do that
                }
            }
        }

        sendPageName = "goal"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);


        await page.getByTestId('admin-panel-edit').click();
        await page.locator('#submit-button').hover();

        sendPageName = "editGoal"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

    test('Action pics', async ({ page }, metadata) => {
        // Create
        await page.goto('/action/create');
        await page.waitForLoadState('networkidle');

        sendFolderPath = "Action"
        sendPageName = "createAction"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

        await page.goto('/actions')
        await page.waitForLoadState('networkidle');

        sendPageName = "actionsPage"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);
    });

    test('Effect', async ({ page }, metadata) => {
        // Create
        await page.goto('/effect/create');
        await page.waitForLoadState('networkidle');

        sendFolderPath = "Effect"
        sendPageName = "createEffect"
        await takeScreenshot(sendFolderPath, sendPageName, page, metadata.project.name);

    });

});
