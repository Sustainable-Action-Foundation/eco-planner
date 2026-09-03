import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

// The seeded org that the admin user manages; it owns everything created here.
const orgName = "Sustainable Action";
// The seeded group in that org, used for the per-group sharing grants.
const groupName = "Hållbarhetsgruppen";

/** The grant `<select>` for the given group in the sharing editor of the roadmap form */
function grantSelect(page: Page, group: string) {
  return page.locator('label').filter({ hasText: group }).locator('select');
}

/**
 * Opens the given roadmap's latest iteration from the front page.
 * The tree on the front page nests child roadmaps inside collapsed `<details>`,
 * so search for the name first; filtering out the parent promotes the match to the top level.
 * Targets the public view: logged-in org members land on their org's page by default,
 * and its filtered tree only holds that org's own roadmaps.
 */
async function openRoadmapFromHome(page: Page, roadmapName: string) {
  await page.goto(`/?org=public&searchFilter=${encodeURIComponent(roadmapName)}`);
  await page.getByRole('link', { name: roadmapName }).first().click();
}

test.describe.serial("Roadmaps tests", () => {
  test.use({ storageState: adminFile });

  // Variables to hold the names of created roadmaps for use across all tests in this describe block.
  let roadmapNameAllFields = "";
  let roadmapNameAllFieldsUpdated = "";
  let roadmapNameRequiredFields = "";
  let roadmapNameRequiredFieldsUpdated = "";

  // Cleanup function to delete any created roadmaps so after a retry there are no duplicates.
  test.beforeAll(/* async */({ /* browser */ }, testInfo) => {
    // Define the roadmap name here so it can be accessed in all later tests.
    // Needs to be unique for each worker so different browsers running tests in parallel don't interfere with each other.
    roadmapNameAllFields = `Test All Fields ${testInfo.retry} ${testInfo.project.name}`;

    // if (testInfo.retry > 0) {
    //   console.info(`Retrying tests, Cleaning up any existing roadmap with name ${roadmapNameAllFields} before retrying.`);

    //   // Page cannot be used in beforeAll so a new context and page here is needed.
    //   const context = await browser.newContext({ storageState: adminFile });
    //   const page = await context.newPage();

    //   await page.goto('/');
    //   await page.waitForLoadState('networkidle');

    //   // Count how many matching items exist
    //   const matchingItems = page.locator('li').filter({ hasText: roadmapNameAllFields });
    //   const count = await matchingItems.count();

    //   // Delete all matching items
    //   for (let i = 0; i < count; i++) {
    //     // firstMatch is the row that all the actions need to be performed on since after each deletion the next item will move up to take its place.
    //     const firstMatch = matchingItems.first();

    //     // All of these actions need to be performed on the correct row so they are using firstMatch as the base locator.
    //     await firstMatch.locator('svg').nth(1).click();
    //     await firstMatch.getByTestId('delete-post').click();
    //     await firstMatch.locator('input[placeholder]').fill(roadmapNameAllFields);
    //     await firstMatch.locator('[type="submit"]').click();

    //     await page.waitForLoadState('networkidle');
    //   }

    //   // Verify all are gone
    //   await expect(matchingItems).toHaveCount(0);
    // }
  });

  test("Create Roadmap and Iteration - All Fields", async ({ page }) => {

    // Navigate to the roadmap creation page
    await page.goto('/roadmap/create');

    // Fill in the roadmap form
    await page.locator('#name').fill(roadmapNameAllFields);

    // Fill description in the tiptap editor
    await page.locator('.tiptap').first().fill('Test All');

    // The seeded admin belongs to exactly one org, so it is preselected; select it explicitly anyway
    await page.locator('#org').selectOption({ label: orgName });

    // Select roadmap type
    await page.locator('#type').selectOption("LOCAL");

    // Fill in actor field
    await page.locator('#actor').fill("Test All");

    // Optional structured geo area (searchable select)
    await page.locator('#geo-area').click();
    await page.locator('#geo-area-dialog-listbox li').filter({ hasText: 'Uppsala län' }).click();

    // Sharing: visible to all org members, and give the seeded group edit access
    await page.locator('input[name="sharing"][value="ORG"]').check();
    await grantSelect(page, groupName).selectOption('RW');

    // Work towards the seeded national roadmap
    await page.locator('#parent-roadmap').click();
    await page.locator('#parent-roadmap-dialog-listbox li').filter({ hasText: 'Rikets färdplan' }).click();

    // Submit the form
    await page.locator('#submit-button').click();

    // Creating a roadmap redirects to the iteration creation page for it
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/iteration\/create/);

    // Fill in the iteration form
    // Fill description in the tiptap editor
    await page.locator('.tiptap').first().fill('Test All');

    // Since the new roadmap works towards the national roadmap, a target version can be selected; "0" means always latest
    await page.locator('#target-version').selectOption('0');

    // Publish the iteration so it is visible outside the group of editors
    await page.locator('#publish').check();

    // Submit the iteration form
    await page.locator('#submit-button').click();

    // Verify successful creation by checking the redirect to the new iteration's page
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+/);

    await expect(page.getByRole('heading', { name: roadmapNameAllFields })).toBeVisible();
  });

  test("Edit iteration, no changes - All Fields", async ({ page }) => {

    // The front page links to the latest iteration of each roadmap
    await openRoadmapFromHome(page, roadmapNameAllFields);

    // Wait for the iteration page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Verify all fields are filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test All');

    // Verify the iteration is still published
    await expect(page.locator('#publish')).toBeChecked();

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Iteration id route redirects to version slug - All Fields", async ({ page }) => {

    // The front page links to the latest iteration of each roadmap
    await openRoadmapFromHome(page, roadmapNameAllFields);

    // Wait for the iteration page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);

    // The version URL holds the roadmap id and version slug but not the iteration id;
    // extract the id from the new-goal link, which carries it as a query parameter
    const { pathname, origin } = new URL(page.url());
    const [, , roadmapId, versionSlug] = pathname.split('/');
    const goalCreateHref = await page.locator('a[href*="iterationId="]').first().getAttribute('href');
    const iterationId = new URL(goalCreateHref ?? '', origin).searchParams.get('iterationId');
    expect(iterationId).toBeTruthy();

    // Linking an iteration by id redirects to the canonical version slug
    await page.goto(`/roadmap/${roadmapId}/iteration/${iterationId}`);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/${versionSlug}`);

    // The iteration's own roadmap is authoritative when the roadmap id in the path is wrong
    await page.goto(`/roadmap/not-a-real-roadmap-id/iteration/${iterationId}`);
    await expect(page).toHaveURL(`/roadmap/${roadmapId}/${versionSlug}`);
  });

  test("Edit roadmap, no changes - All Fields", async ({ page }) => {

    await openRoadmapFromHome(page, roadmapNameAllFields);

    // Go from the iteration page to its parent roadmap page
    await page.getByTestId('show-roadmap').click();

    // Wait for the roadmap page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    await expect(page.locator('#name')).toHaveValue(roadmapNameAllFields);

    // Verify all fields are filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test All');

    // Verify type is set
    await expect(page.locator('#type')).toHaveValue('LOCAL');

    // Verify actor field is filled in
    await expect(page.locator('#actor')).toHaveValue('Test All');

    // Verify geo area is set
    await expect(page.locator('#geo-area')).toContainText('Uppsala län');

    // Verify visibility is set to org members
    await expect(page.locator('input[name="sharing"][value="ORG"]')).toBeChecked();

    // Verify the group grant is set to read and edit
    await expect(grantSelect(page, groupName)).toHaveValue('RW');

    // Verify the parent roadmap is set
    await expect(page.locator('#parent-roadmap')).toContainText('Rikets färdplan');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: roadmapNameAllFields })).toBeVisible();
  });

  test("Edit iteration, updated fields - All Fields", async ({ page }) => {

    await openRoadmapFromHome(page, roadmapNameAllFields);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Edit description in the tiptap editor; keep the iteration published
    await page.locator('.tiptap').first().fill('Updated Iteration Description All');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Iteration Description All');

    // Verify the iteration is still published
    await expect(page.locator('#publish')).toBeChecked();
  });

  test("Edit roadmap, updated fields - All Fields", async ({ page }, testInfo) => {

    roadmapNameAllFieldsUpdated = `Test Updated All Fields ${testInfo.retry} ${testInfo.project.name}`;

    await openRoadmapFromHome(page, roadmapNameAllFields);

    // Go from the iteration page to its parent roadmap page
    await page.getByTestId('show-roadmap').click();

    // Wait for the roadmap page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').fill(roadmapNameAllFieldsUpdated);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Description All');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').fill("Updated Actor All");

    // Edit visibility - the admin user is an org manager, so the public option is available
    await page.locator('input[name="sharing"][value="PUBLIC"]').check();

    // Downgrade the group grant to read-only
    await grantSelect(page, groupName).selectOption('RO');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: roadmapNameAllFieldsUpdated })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue(roadmapNameAllFieldsUpdated);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Description All');

    // Verify type was updated
    await expect(page.locator('#type')).toHaveValue('OTHER');

    // Verify actor field was updated
    await expect(page.locator('#actor')).toHaveValue('Updated Actor All');

    // Verify visibility was changed to public
    await expect(page.locator('input[name="sharing"][value="PUBLIC"]')).toBeChecked();

    // Verify the group grant was downgraded to read-only
    await expect(grantSelect(page, groupName)).toHaveValue('RO');
  });

  test("Create Roadmap and Iteration - Required Fields", async ({ page }, testInfo) => {

    roadmapNameRequiredFields = `Test Required ${testInfo.retry} ${testInfo.project.name}`;
    // Navigate to the roadmap creation page
    await page.goto('/roadmap/create');

    // Fill in the roadmap form
    await page.locator('#name').fill(roadmapNameRequiredFields);

    // Fill description in the tiptap editor (required on create)
    await page.locator('.tiptap').first().fill('Test Required');

    // Several orgs are seeded (and super admins can create in all of them), so the org must be chosen
    await page.locator('#org').selectOption({ label: orgName });

    // Select roadmap type
    await page.locator('#type').selectOption("LOCAL");

    // Fill in actor field
    await page.locator('#actor').fill("Test Required");

    // Visibility defaults to org members; the admin user is an org manager, so no group grant is needed

    // Submit the form
    await page.locator('#submit-button').click();

    // Creating a roadmap redirects to the iteration creation page for it
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/iteration\/create/);

    // The iteration form has no required fields when the roadmap comes from the query;
    // publish so the iteration is visible outside the group of editors
    await page.locator('#publish').check();

    // Submit the iteration form
    await page.locator('#submit-button').click();

    // Verify successful creation by checking the redirect to the new iteration's page
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+/);

    await expect(page.getByRole('heading', { name: roadmapNameRequiredFields })).toBeVisible();
  });

  test("Edit iteration, no changes - Required Fields", async ({ page }) => {

    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');

    await page.getByRole('link', { name: `${roadmapNameRequiredFields}` }).first().click();

    // Wait for the iteration page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Verify the iteration is still published
    await expect(page.locator('#publish')).toBeChecked();

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);
    await expect(page.getByTestId('admin-panel-edit')).toBeVisible();
  });

  test("Edit roadmap, no changes - Required Fields", async ({ page }) => {

    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');

    await page.getByRole('link', { name: `${roadmapNameRequiredFields}` }).first().click();

    // Go from the iteration page to its parent roadmap page
    await page.getByTestId('show-roadmap').click();

    // Wait for the roadmap page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name is filled in
    await expect(page.locator('#name')).toHaveValue(roadmapNameRequiredFields);

    // Verify description in the tiptap editor is filled in
    await expect(page.locator('.tiptap').first()).toHaveText('Test Required');

    // Verify type is set
    await expect(page.locator('#type')).toHaveValue('LOCAL');

    // Verify actor field is filled in
    await expect(page.locator('#actor')).toHaveValue('Test Required');

    // Verify visibility is still the default (org members)
    await expect(page.locator('input[name="sharing"][value="ORG"]')).toBeChecked();

    // Verify no grant was given to the group
    await expect(grantSelect(page, groupName)).toHaveValue('NONE');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: roadmapNameRequiredFields })).toBeVisible();
  });

  test("Edit iteration, updated fields - Required Fields", async ({ page }) => {

    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');

    await page.getByRole('link', { name: `${roadmapNameRequiredFields}` }).first().click();

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Edit description in the tiptap editor; keep the iteration published
    await page.locator('.tiptap').first().fill('Updated Iteration Description Required');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+\/edit/);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toContainText('Updated Iteration Description Required');

    // Verify the iteration is still published
    await expect(page.locator('#publish')).toBeChecked();
  });

  test("Edit roadmap, updated fields - Required Fields", async ({ page }, testInfo) => {

    roadmapNameRequiredFieldsUpdated = `Test Updated Required Fields ${testInfo.retry} ${testInfo.project.name}`;
    // The public view: logged-in org members land on their org's page by default,
    // which only lists that org's own content
    await page.goto('/?org=public');

    await page.getByRole('link', { name: `${roadmapNameRequiredFields}` }).first().click();

    // Go from the iteration page to its parent roadmap page
    await page.getByTestId('show-roadmap').click();

    // Wait for the roadmap page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);

    // Click the edit button
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Edit name
    await page.locator('#name').fill(roadmapNameRequiredFieldsUpdated);

    // Edit description in the tiptap editor
    await page.locator('.tiptap').first().fill('Updated Description Required');

    // Edit type
    await page.locator('#type').selectOption("OTHER");

    // Edit actor field
    await page.locator('#actor').fill("Updated Actor Required");

    // Edit visibility - only granted groups may see the roadmap
    await page.locator('input[name="sharing"][value="GROUPS"]').check();

    // Give the group edit access
    await grantSelect(page, groupName).selectOption('RW');

    // Click the save button
    await page.locator('#submit-button').click();

    // Verify the save was successful
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+$/);
    await expect(page.getByRole('heading', { name: roadmapNameRequiredFieldsUpdated })).toBeVisible();

    // Click the edit button again to verify all changes were saved
    await page.getByTestId('admin-panel-edit').click();

    // Wait for edit page to load
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/edit/);

    // Verify name was updated
    await expect(page.locator('#name')).toHaveValue(roadmapNameRequiredFieldsUpdated);

    // Verify description was updated
    await expect(page.locator('.tiptap').first()).toHaveText('Updated Description Required');

    // Verify type was updated
    await expect(page.locator('#type')).toHaveValue('OTHER');

    // Verify actor field was updated
    await expect(page.locator('#actor')).toHaveValue('Updated Actor Required');

    // Verify visibility was changed to granted groups only
    await expect(page.locator('input[name="sharing"][value="GROUPS"]')).toBeChecked();

    // Verify the group was given edit access
    await expect(grantSelect(page, groupName)).toHaveValue('RW');
  });

});
