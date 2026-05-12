import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

async function fillManualDataSeries(page: Page, rows: Array<[number, number]>) {
  const insertRowButton = page.getByRole("button", { name: /Insert row to bottom|Infoga rad underst/ });

  for (let i = 1; i < rows.length; i++) {
    await insertRowButton.click();
  }

  for (let row = 0; row < rows.length; row++) {
    const [year, value] = rows[row];
    await page.locator(`[data-row="${row}"][data-column="1"] input`).fill(String(year));
    await page.locator(`[data-row="${row}"][data-column="2"] input`).fill(String(value));
  }
}

test.describe("Goals tests", () => {
  test.use({ storageState: adminFile });
  const indicatorRequiredOnly = "Required\\only";
  const indicatorRequiredUpdated = "Required\\updated\\only";
  const unitRequiredOnly = "meter";
  const unitRequiredUpdated = "yard";
  const nameAll = "Test goal";
  const descriptionAll = "This is a test goal";
  const indicatorAll = "All\\fields";
  const indicatorAllUpdated = "All\\updated\\fields";
  const unitAll = "tonnes";
  const unitAllUpdated = "grams";

  test("Create goal required only", async ({ page }) => {
    // Opening the form
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("create-button").click();
    await page.getByTestId("create-goal").click();
    await page.waitForLoadState("networkidle");

    // Form Part 1
    await page.locator("#parent-roadmap").click();
    await page.locator("#parent-roadmap-dialog-listbox li").filter({ hasText: "Rikets färdplan" }).filter({ hasText: "2" }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap

    // Form Part 2 is optional, so we skip it

    // Form Part 3
    // Might be switched out for a pre-written recipe when they are fixed
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await page.locator("#indicatorParameter").fill(indicatorRequiredOnly);
    await page.locator("#dataUnit").fill(unitRequiredOnly);

    await fillManualDataSeries(page, Array.from({ length: 10 }, (_, i) => [2020 + i, 1]));

    // Form Submit
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("main")).toContainText("goal.title_label");
  });

  test("Edit goal required only", async ({ page }) => {

    // will only work correctly if 'Create goal required only' is run before

    // Navigate to roadmap
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Rikets färdplan" }).click();
    await page.getByRole("heading", { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole("radio", { name: "table_selector.table" }).click();
    await page.getByRole("link", { name: indicatorRequiredOnly }).first().click();
    // Wait for page to load
    await page.getByRole("heading", { name: indicatorRequiredOnly }).first().hover();

    // Enter edit form
    await page.getByRole("link", { name: "table_menu.edit" }).click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator("#goalName")).toBeEmpty();
    await expect.soft(page.locator("#description")).toBeEmpty();

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="dataSeriesType"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await expect.soft(page.locator("#indicatorParameter")).toHaveValue(indicatorRequiredOnly);
    await expect.soft(page.locator("#dataUnit")).toHaveValue(unitRequiredOnly);

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`[data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`[data-row="${i}"][data-column="2"] input`)).toHaveValue("1");
    }

    await expect.soft(page.locator("#baselineSelector")).toHaveValue("CUSTOM");
    await expect.soft(page.locator("#isFeatured")).not.toBeChecked();

    // Submit
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#comment-text")).toBeEmpty();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Editing fields
    await page.locator("#indicatorParameter").fill(indicatorRequiredUpdated);
    await page.locator("#dataUnit").fill(unitRequiredUpdated);

    await page.waitForLoadState("networkidle");

    for (let i = 0; i < 10; i++) {
      await page.locator(`[data-row="${i}"][data-column="1"] input`).fill(String(2025 + i));
      await page.locator(`[data-row="${i}"][data-column="2"] input`).fill("4");
    }

    await page.locator("#baselineSelector").selectOption("INITIAL_NON_ZERO");
    await page.locator("#isFeatured").check();

    // Submit
    await page.locator("#submit-button").click();
    await page.locator("#comment-text").hover();
    // await page.waitForLoadState("networkidle");
    await expect(page.locator("#comment-text")).toBeEmpty();

    // Reenter edit form to see that everything is updated
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    await expect.soft(page.locator("#indicatorParameter")).toHaveValue(indicatorRequiredUpdated);
    await expect.soft(page.locator("#dataUnit")).toHaveValue(unitRequiredUpdated); // Might need to be changed when the thing that checks for changes is fixed, currently it doesn't recognize the change of data unit as a change so it doesn't update the value in the form

    for (let i = 0; i < 10; i++) {
      await expect.soft(page.locator(`[data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2025 + i));
      await expect.soft(page.locator(`[data-row="${i}"][data-column="2"] input`)).toHaveValue("4");
    }

    await expect.soft(page.locator("#baselineSelector")).toHaveValue("INITIAL_NON_ZERO");
    await expect(page.locator("#isFeatured")).toBeChecked();

    // Submit without changes to see that the form is not broken
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#comment-text")).toBeEmpty();
  });

  test("Create goal all", async ({ page }) => {
    // Opening the form
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("create-button").click();
    await page.getByTestId("create-goal").click();
    await page.waitForLoadState("networkidle");

    // Form Part 1
    await page.locator("#parent-roadmap").click();
    await page.locator("#parent-roadmap-dialog-listbox li").filter({ hasText: "Rikets färdplan" }).filter({ hasText: "2" }).click(); // Checks for Rikets färdplan to be contained in an option, with version 2 to avoid selecting the wrong roadmap


    // Form Part 2
    await page.locator("#goalName").fill(nameAll);
    await page.getByRole("textbox").nth(1).fill(descriptionAll); // Might be a better way of getting this element

    // Form Part 3
    // Might be switch out for a pre-written recipe when they are fixed
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();
    await page.locator("#indicatorParameter").fill(indicatorAll);
    await page.locator("#dataUnit").fill(unitAll);

    await fillManualDataSeries(page, Array.from({ length: 30 }, (_, i) => [2020 + i, i]));

    // Form part 4
    await page.locator("#baselineSelector").selectOption({ value: "INITIAL_NON_ZERO" });
    /*
      await page.locator('#baselineSelector').selectOption({ value: "INHERIT" });
      await page.locator('#selectedRoadmap').selectOption({ index: 1 });
      await page.locator('#inheritFrom').selectOption({ index: 1 });
    */
    // Form part 5
    await page.locator("#isFeatured").check();

    // Form Submit
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").nth(1)).toHaveText(nameAll);
    await expect(page.locator("#rich-description")).toHaveText(descriptionAll);
  });

  test("Edit goal all", async ({ page }) => {

    // Will only work correctly if 'Create goal all' is run before

    // Navigate to roadmap
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: "Rikets färdplan" }).click();
    await page.getByRole("heading", { name: "Rikets färdplan" }).hover(); // "networkidle" doesn't work for this for some reason so we are hovering to wait for load state where needed

    // Navigate to goal
    await page.getByRole("radio", { name: "table_selector.table" }).click();
    await page.getByRole("link", { name: nameAll }).first().click();
    await page.waitForLoadState("networkidle");
    // Wait for page to load
    await page.getByRole("heading", { name: nameAll }).first().hover();

    // Enter edit form
    await page.getByRole("link", { name: "table_menu.edit" }).click();
    await page.waitForLoadState("networkidle");

    // Check that everything is auto filled
    await expect.soft(page.locator("#goalName")).toHaveValue(nameAll);
    await expect.soft(page.locator("#description")).toHaveText(descriptionAll);

    // Expect the form to remember that we chose manual input, even though this is not the default choice
    await expect.soft(page.locator('input[name="dataSeriesType"][value="MANUAL"]')).toBeChecked();

    // Set to manual input in case it isn't, to see if the values are saved correctly at least
    await page.locator('input[name="dataSeriesType"][value="MANUAL"]').check();

    await expect.soft(page.locator("#indicatorParameter")).toHaveValue(indicatorAll);
    await expect.soft(page.locator("#dataUnit")).toHaveText(unitAll);
    for (let i = 0; i < 30; i++) {
      await expect.soft(page.locator(`[data-row="${i}"][data-column="1"] input`)).toHaveValue(String(2020 + i));
      await expect.soft(page.locator(`[data-row="${i}"][data-column="2"] input`)).toHaveValue(String(i));
    }

    await expect.soft(page.locator("#baselineSelector")).toHaveValue("INITIAL_NON_ZERO");
    await expect.soft(page.locator("#isFeatured")).toBeChecked();

    // Submit
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#comment-text")).toBeEmpty();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Editing form
    await page.locator("#goalName").fill("Edited Test");
    await page.locator("#description").fill("Edited test description"); // Does not work, needs a different action to fill

    await page.locator("#indicatorParameter").fill(indicatorAllUpdated);
    await page.locator("#dataUnit").fill(unitAllUpdated);

    await page.getByRole("tab").nth(1).click();
    await page.locator("#recipeVariable0-dialog").click();
    await page.locator("#recipeVariable0-dialog-tree-Rikets-färdplan (v1)").click();
    await page.getByRole("treeitem").first().click();
    await page.locator("#scalar-skalär").fill("48");

    await page.locator("#baselineSelector").selectOption("INITIAL");
    await page.locator("#isFeatured").uncheck();

    // Submit
    await page.locator("#submit-button").click();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#comment-text")).toBeEmpty();

    // Reenter edit form
    await page.getByTestId("admin-panel-edit").click();
    await page.waitForLoadState("networkidle");

    // Check that edits have saved
    await expect.soft(page.locator("#goalName")).toHaveValue("Edited Test");
    await expect.soft(page.locator("#description")).toHaveText("Edited test description");

    await expect.soft(page.locator("#indicatorParameter")).toHaveValue(indicatorAllUpdated);
    await expect.soft(page.locator("#dataUnit")).toHaveValue(unitAllUpdated); // Might need to be changed when the thing that checks for changes is fixed, currently it doesn't recognize the change of data unit as a change so it doesn't update the value in the form 

    await page.getByRole("tab").nth(1).click();
    await expect.soft(page.locator("#recipeVariable0")).not.toBeEmpty();
    await expect.soft(page.locator("#scalar-skalär")).toHaveValue("48");
    await expect.soft(page.locator("#baselineSelector")).toHaveValue("INITIAL");

    await expect(page.locator("#isFeatured")).not.toBeChecked();
  });
});