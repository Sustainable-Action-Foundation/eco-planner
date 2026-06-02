import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const outputDir = path.join(cwd(), "tests/out/screenshots");
const adminFile = path.join(cwd(), "tests/.auth/admin.json");

let sendPageName = ""; // Denotes what a screenshot is of

/*
  To run screenshot tests locally you must run: yarn screenshot
*/
async function takeScreenshot(pageName: string, page: Page, worker: string) {
  await ensureToastPassthrough(page);
  
  await isSidebarOpen(page, true);

  await page.screenshot({ path: `${outputDir}/${pageName}/${worker}.jpeg`, fullPage: false, animations: "disabled" });
  await page.screenshot({ path: `${outputDir}/${pageName}-fullPage/${worker}.jpeg`, fullPage: true, animations: "disabled" });
}

async function ensureToastPassthrough(page: Page) {
  if (page.isClosed()) {
    return;
  }

  await page.addStyleTag({
    content: "aside[data-testid='toast-list']{pointer-events:none !important;}",
  });
}

async function safePressEscape(page: Page) {
  if (page.isClosed()) {
    return;
  }

  try {
    await page.keyboard.press("Escape");
  } catch {
    // Best effort; page may have navigated or closed.
  }
}

async function isSidebarOpen(page: Page, wantedClosed: boolean) { // Checks if the sidebar is open
  await ensureToastPassthrough(page);
  const isSidebarOpen = await page.getByTestId('language-switcher-dialog-button').boundingBox();
  if (wantedClosed) {
    if (isSidebarOpen === null) { /* empty */ }
    else if (isSidebarOpen.width > 100) {
      await page.getByRole('checkbox').first().click({ force: true });
    }
  }
  else if (isSidebarOpen === null) {
    await page.getByRole("checkbox").first().click({ force: true });
  }
  else if (isSidebarOpen.width < 100) {
    await page.getByRole("checkbox").first().click({ force: true });
  }
}

test.describe('Screenshot tests', () => {

  test('Main page pics', async ({ page }, metadata) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    // Main page
    await expect.soft(page.getByTestId('home-title')).toBeVisible();
    sendPageName = "mainPage"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
    await isSidebarOpen(page, false);
    await page.screenshot({ path: `${outputDir}/mainPage/${metadata.project.name}-sidebar.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `${outputDir}/mainPage-fullPage/${metadata.project.name}-sidebar.jpeg`, fullPage: true, animations: "disabled" });
  });

  async function sidebarTest(page: Page, openState: string, worker: string) {
    await ensureToastPassthrough(page);
    // Create menu popover
    await page.getByTestId('create-button').click();
    await expect.soft(page.getByTestId('create-roadmap-series')).toBeVisible();

    await page.screenshot({ path: `${outputDir}/createMenuPopped/${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `${outputDir}/createMenuPopped-fullPage/${openState}-${worker}.jpeg`, fullPage: true, animations: "disabled" });
    await safePressEscape(page);

    // Language popover
    await page.getByTestId('language-switcher-dialog-button').click();
    await expect.soft(page.getByTestId('language-switcher-option-English')).toBeVisible();
    await page.screenshot({ path: `${outputDir}/languageMenuPopped/${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `${outputDir}/languageMenuPopped-fullPage/${openState}-${worker}.jpeg`, fullPage: true, animations: "disabled" });
    await safePressEscape(page);

    // Settings popover
    await expect.soft(page.getByTestId('settings-button')).toBeVisible();
    await page.getByTestId('settings-button').click({ force: true });
    await expect.soft(page.locator('#allowStorage')).toBeVisible();
    await page.screenshot({ path: `${outputDir}/settingsMenuPopped/${openState}-${worker}.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `${outputDir}/settingsMenuPopped-fullPage/${openState}-${worker}.jpeg`, fullPage: true, animations: "disabled" });
    await safePressEscape(page);
  }

  test('Sidebar pics', async ({ page }, metadata) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    let tooSmallScreen = false;

    await isSidebarOpen(page, true);
    const sidebarStatus = await page.getByTestId('language-switcher-dialog-button').boundingBox();
    if (sidebarStatus === null) {
      tooSmallScreen = true;
    }
    await isSidebarOpen(page, false);

    // First runs sidebarTest with the sidebar open then closes it and runs the test again
    await sidebarTest(page, "open", metadata.project.name);
    if (!tooSmallScreen) {
      await isSidebarOpen(page, true);
      await sidebarTest(page, "closed", metadata.project.name);
    }
  });

  test('Account pics', async ({ page }, metadata) => {
    // Create account page
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createAccount"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Log in page
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#remember')).toBeVisible();
    sendPageName = "logIn"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
  });

});

test.describe('Screenshots Admin', () => {
  test.use({ storageState: adminFile });

  test('Logged in sidebar pics', async ({ page }, metadata) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.getByTestId('home-title')).toBeVisible();

    await isSidebarOpen(page, false);

    // Wanted the sidebar to be open, so couldn't use the takeScreenshot function
    await page.screenshot({ path: `${outputDir}/loggedIn/${metadata.project.name}.jpeg`, fullPage: false, animations: "disabled" });
    await page.screenshot({ path: `${outputDir}/loggedIn-fullPage/${metadata.project.name}.jpeg`, fullPage: true, animations: "disabled" });
  });

  test('My account pics', async ({ page }, metadata) => {
    // My account page
    await page.goto('/@admin');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.getByRole('heading', { name: 'admin' })).toBeVisible();
    sendPageName = "myAccount"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
  });

  test('Roadmap Series pics', async ({ page }, metadata) => {
    // Roadmap Series create
    await page.goto('/metaRoadmap/create');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createSeries"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Roadmap Series 
    await page.goto('/');
    await page.waitForLoadState("networkidle");
    await ensureToastPassthrough(page);

    await page.getByRole('link', { name: "Rikets färdplan" }).scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: "Rikets färdplan" }).click(metadata.project.name.includes("Galaxy") ? { force: true } : undefined);
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    await page.getByTestId('show-roadmap-series').click();
    await page.waitForLoadState('networkidle');

    // await page.getByRole('heading', { name: 'roadmap_versions' }).hover();
    await expect.soft(page.getByRole('heading', { name: 'roadmap_versions' })).toBeVisible();
    sendPageName = "roadmapSeries"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Roadmap Series Edit
    await page.getByTestId('admin-panel-edit').click();
    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "editRoadmapSeries"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
  });

  test('Roadmap pics', async ({ page }, metadata) => {
    // Roadmap create
    await page.goto('/roadmap/create');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createRoadmap"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Roadmap
    await page.goto('/');
    await page.waitForLoadState("networkidle");
    await ensureToastPassthrough(page);

    await isSidebarOpen(page, false);

    await page.getByRole('link', { name: "Rikets färdplan" }).scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: "Rikets färdplan" }).click(metadata.project.name.includes("Galaxy") ? { force: true } : undefined);

    await expect.soft(page.getByRole('heading', { name: "Rikets färdplan" })).toBeVisible();
    sendPageName = "roadmap"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Roadmap Edit
    await page.getByTestId('admin-panel-edit').click();

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "editRoadmap"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
  });


  test('Goal pics', async ({ page }, metadata) => {
    // Create
    await page.goto('/goal/create');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createGoal"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    // Goal
    await page.goto('/');
    await page.waitForLoadState("networkidle");
    await ensureToastPassthrough(page);

    await page.getByRole('link', { name: "Rikets färdplan" }).scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: "Rikets färdplan" }).click(metadata.project.name.includes("Galaxy") ? { force: true } : undefined);
    await page.getByRole('heading', { name: "Rikets färdplan" }).hover();

    const URL = page.url();
    let i = 0;

    while (URL === page.url()) { // Loop to open all of the tree items to find a goal
      try {
        await page.getByRole('listitem').nth(i).click();
        i++;
      } catch {
        if (await page.locator('#select-graphType').isVisible()) {
          break;
        } else {
          // How do you throw an error good?
          await expect(page.getByTestId('home-title')).toBeVisible(); // Needed it to throw an error and stop the test but didn't know a good way to do that
        }
      }
    }

    await expect.soft(page.locator('#select-graphType')).toBeVisible();
    sendPageName = "goal"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    await page.getByTestId('admin-panel-edit').click();

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "editGoal"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

  });

  test('Action pics', async ({ page }, metadata) => {
    // Create
    await page.goto('/action/create');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createAction"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

    await page.goto('/actions');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.getByRole('heading').first()).toBeVisible();
    sendPageName = "actionsPage"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);
  });

  test('Effect', async ({ page }, metadata) => {
    // Create
    await page.goto('/effect/create');
    await page.waitForLoadState('networkidle');
    await ensureToastPassthrough(page);

    await expect.soft(page.locator('#submit-button')).toBeVisible();
    sendPageName = "createEffect"; // What the screenshot is of
    await takeScreenshot(sendPageName, page, metadata.project.name);

  });
});