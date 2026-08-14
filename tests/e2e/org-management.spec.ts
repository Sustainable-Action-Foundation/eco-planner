import { expect, test } from "playwright/test";
import type { Page } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const verifiedFile = path.join(cwd(), "tests/.auth/verified.json");

// The seeded org admin manages, and its seeded group (Anita + Anton + the guest Greta)
const orgName = "Sustainable Action";
const seededGroupName = "Hållbarhetsgruppen";

/** Opens the management page of the seeded org via its landing page's manager link */
async function openManagePage(page: Page) {
  await page.goto("/");
  const orgHref = await page.locator('nav[aria-label*="org_nav_label"]').getByRole("link", { name: orgName }).getAttribute("href");
  await page.goto(orgHref ?? "/");
  await expect(page.getByTestId("home-title")).toHaveText(orgName);
  // The expect's longer timeout absorbs slow streaming under parallel suite load
  const manageLink = page.getByRole("link", { name: "org_groups.manage_groups" });
  await expect(manageLink).toBeVisible();
  await manageLink.click();
  await page.waitForURL(/\/org\/[a-z0-9-]+\/groups/);
}

test.describe.serial("Org management", () => {
  test.use({ storageState: adminFile });

  let groupName = "";
  let groupNameUpdated = "";

  test.beforeAll(({}, testInfo) => {
    // Unique per browser project and retry so parallel/retried runs don't collide
    groupName = `Testgruppen ${testInfo.retry} ${testInfo.project.name}`;
    groupNameUpdated = `${groupName} 2`;
  });

  test("Member list is collapsed and shows all members", async ({ page }) => {
    await openManagePage(page);

    // Collapsed by default
    await expect(page.getByTestId("members-details")).toBeVisible();
    await expect(page.getByTestId("member-row").first()).not.toBeVisible();

    await page.getByTestId("members-details").locator("summary").click();
    const rows = page.getByTestId("member-row");
    await expect(rows.filter({ hasText: "admin" })).toBeVisible();
    await expect(rows.filter({ hasText: "Anita" })).toBeVisible();
    await expect(rows.filter({ hasText: "Anton" })).toBeVisible();
    // The guest shows a static role label (no select) and her lack of a home org
    await expect(rows.filter({ hasText: "Greta" })).toContainText("org_groups.home_org_none");
    await expect(rows.filter({ hasText: "Greta" }).getByTestId("member-role")).toHaveCount(0);
  });

  test("Own role is locked; promoting and demoting another member round-trips", async ({ page }) => {
    await openManagePage(page);
    await page.getByTestId("members-details").locator("summary").click();

    const adminRow = page.getByTestId("member-row").filter({ hasText: "admin" });
    await expect(adminRow.getByTestId("member-role")).toBeDisabled();

    const anitaRole = () => page.getByTestId("member-row").filter({ hasText: "Anita" }).getByTestId("member-role");
    await anitaRole().selectOption("MANAGER");
    // The page refreshes after saving; the persisted value must come back as MANAGER
    await expect(anitaRole()).toHaveValue("MANAGER");

    await anitaRole().selectOption("MEMBER");
    await expect(anitaRole()).toHaveValue("MEMBER");
  });

  test("Seeded group renders as a list row without an editor", async ({ page }) => {
    await openManagePage(page);

    const row = page.getByTestId("group-row").filter({ hasText: seededGroupName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("org_groups.member_count");
    await expect(row).toContainText("Anita");
    await expect(row).toContainText("Anton");
    await expect(row).toContainText("Greta");
    await expect(page.getByTestId("group-editor")).toHaveCount(0);
  });

  test("Create a group with members through the searchable multiselect", async ({ page }) => {
    await openManagePage(page);

    await page.getByTestId("create-group-name").fill(groupName);
    await page.locator("#create-group-members").click();
    await page.locator("#create-group-members-dialog input[type='text']").fill("admin");
    await page.locator("#create-group-members-dialog-listbox li").filter({ hasText: "admin" }).first().click();
    await page.locator("#create-group-members-dialog input[type='text']").fill("Anita");
    await page.locator("#create-group-members-dialog-listbox li").filter({ hasText: "Anita" }).first().click();
    await page.keyboard.press("Escape");
    await page.getByTestId("create-group-submit").click();

    const row = page.getByTestId("group-row").filter({ hasText: groupName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("admin");
    await expect(row).toContainText("Anita");
  });

  test("Duplicate group names are rejected", async ({ page }) => {
    await openManagePage(page);

    await page.getByTestId("create-group-name").fill(groupName);
    await page.getByTestId("create-group-submit").click();
    await expect(page.getByText("group.name_taken")).toBeVisible();
  });

  test("Edit a group: rename and change members", async ({ page }) => {
    await openManagePage(page);

    // Once the editor opens, the name moves into an input value, so hasText no
    // longer matches the row; track it by its stable group id instead
    const groupId = await page.locator("li[data-group-id]").filter({ hasText: groupName }).getAttribute("data-group-id");
    const li = page.locator(`li[data-group-id="${groupId}"]`);
    await li.getByTestId("group-edit").click();
    await expect(li.getByTestId("group-editor")).toBeVisible();

    // Deselect admin (clicking a selected option toggles it off)
    await li.locator('button[role="combobox"]').click();
    await page.locator('[id$="-dialog-listbox"]:visible').locator("li").filter({ hasText: "admin" }).first().click();
    await page.keyboard.press("Escape");

    await li.getByTestId("group-name").fill(groupNameUpdated);
    await li.getByTestId("group-save").click();

    // The editor stays open through the refresh, remounted with the server's state
    await expect(li.getByTestId("group-name")).toHaveValue(groupNameUpdated);
    await expect(li.locator('button[role="combobox"]')).toContainText("Anita");
    await expect(li.locator('button[role="combobox"]')).not.toContainText("admin");

    // Closing the editor reveals the updated list row
    await li.getByTestId("group-cancel").click();
    const updatedRow = page.getByTestId("group-row").filter({ hasText: groupNameUpdated });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText("Anita");
  });

  test("Deleting a group requires arming the button", async ({ page }) => {
    await openManagePage(page);

    const groupId = await page.locator("li[data-group-id]").filter({ hasText: groupNameUpdated }).getAttribute("data-group-id");
    const li = page.locator(`li[data-group-id="${groupId}"]`);
    await li.getByTestId("group-edit").click();

    // First click arms, second click deletes
    await li.getByTestId("group-delete").click();
    await expect(li.getByTestId("group-delete")).toHaveText("org_groups.confirm_delete");
    await li.getByTestId("group-delete").click();

    await expect(page.getByTestId("group-row").filter({ hasText: groupNameUpdated })).toHaveCount(0);
  });
});

test.describe("Org management access", () => {
  test.use({ storageState: verifiedFile });

  test("Regular members get no manage link and no page", async ({ page }) => {
    await page.goto("/");
    const orgHref = await page.locator('nav[aria-label*="org_nav_label"]').getByRole("link", { name: orgName }).getAttribute("href");
    await page.goto(orgHref ?? "/");
    await expect(page.getByTestId("home-title")).toHaveText(orgName);
    await expect(page.getByRole("link", { name: "org_groups.manage_groups" })).toHaveCount(0);

    // The management page itself hides behind a 404 (the org id is in the landing URL)
    const orgId = new URL(orgHref ?? "", "http://localhost").searchParams.get("org");
    await page.goto(`/org/${orgId}/groups`);
    await expect(page.getByText("404.title")).toBeVisible();
    await expect(page.getByTestId("members-details")).toHaveCount(0);
  });

  test("Role and group APIs reject non-managers", async ({ request }) => {
    const roleChange = await request.put("/api/org-membership", { data: { membershipId: "00000000-0000-0000-0000-000000000000", role: "MANAGER" } });
    expect(roleChange.status()).toBe(404);
    const groupCreate = await request.post("/api/group", { data: { orgId: "00000000-0000-0000-0000-000000000000", name: "Hax" } });
    expect(groupCreate.status()).toBe(403);
  });
});
