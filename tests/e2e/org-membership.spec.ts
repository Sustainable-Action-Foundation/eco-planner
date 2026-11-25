import path from "node:path";
import { cwd } from "node:process";
import type { Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { loginContext, memberAdminEntry, memberContext, orgIdByName, Seed } from "../lib/api";
import { pickSingleSearchOption, visible } from "../lib/forms";
import { linkPlace, newLinkUser } from "../lib/login-link";

/*
 * Membership administration on the org manage page (/org/<id>/groups): a super
 * admin adds an existing user to an org, moves them to another and removes them.
 * Managers, and a super admin with the powers off, get the page without it.
 *
 * The user is an account of the test's own, made through the mailed-link flow
 * (enrolled in "Bodens kommun" by its address), so the browser projects never
 * race over a seeded user and nothing seeded changes. The access rules and the
 * rest of the contract are in tests/api/org-membership.spec.ts.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

const firstOrg = "Kiruna kommun";
const secondOrg = "Region Norrbotten";
/** Manager of the first org */
const firstOrgManager = "Lars Niia";

function panel(page: Page): Locator {
  return page.getByTestId("member-admin").filter({ visible: true });
}

async function openManagePage(page: Page, orgId: string) {
  await page.goto(`/org/${orgId}/groups`);
  await expect(page.getByTestId("members-details").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
}

/** Runs a click that sends a membership request and resolves with the API's status */
async function membershipRequest(page: Page, method: "POST" | "PATCH" | "DELETE", action: () => Promise<void>): Promise<number> {
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/org-membership" && response.request().method() === method),
    action(),
  ]);
  return response.status();
}

function successToast(page: Page, key: string): Locator {
  return page.getByTestId("toast-list").locator('dialog[role="status"]').filter({ hasText: key });
}

/**
 * Picks the org's member with this address once the list has it: the list comes back
 * through router.refresh(), so right after a change the first look may be the old one.
 */
async function pickMember(page: Page, email: string) {
  await expect(async () => {
    await pickSingleSearchOption(page, "member-admin-member", email);
    await expect(panel(page).getByTestId("member-admin-actions")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await expect(visible(page, "#member-admin-member")).toContainText(email);
}

test.describe("Membership administration as super admin", () => {
  test.use({ storageState: adminFile });

  test("a super admin adds a user to an org, moves them to another and removes them", async ({ page, admin, playwright, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    const user = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-ui");
    const [firstId, secondId] = await Promise.all([orgIdByName(admin, firstOrg), orgIdByName(admin, secondOrg)]);
    try {
      await openManagePage(page, firstId);
      await expect(panel(page)).toBeVisible();
      await expect(panel(page)).toContainText("org_groups.member_admin.heading");

      // Add: found by address among everyone outside the org; nothing to send until someone is picked
      const add = panel(page).getByTestId("member-admin-add-submit");
      await expect(add).toBeDisabled();
      await pickSingleSearchOption(page, "member-admin-user", user.email);
      // The option says where the user belongs today
      await expect(visible(page, "#member-admin-user")).toContainText(linkPlace.orgName);
      expect(await membershipRequest(page, "POST", () => add.click())).toBe(201);
      await expect(successToast(page, "org_groups.member_admin.added_toast")).toBeVisible();
      // The select is cleared for the next one
      await expect(visible(page, "#member-admin-user")).not.toContainText(user.email);
      await expect(add).toBeDisabled();

      // Move: the new member is in the org's list; a target has to be picked first
      await pickMember(page, user.email);
      const move = panel(page).getByTestId("member-admin-move-submit");
      await expect(move).toBeDisabled();
      // A plain member among others is no last manager
      await expect(panel(page).getByTestId("member-admin-last-manager")).toHaveCount(0);
      await pickSingleSearchOption(page, "member-admin-target", secondOrg);
      expect(await membershipRequest(page, "PATCH", () => move.click())).toBe(200);
      await expect(successToast(page, "org_groups.member_admin.moved_toast")).toBeVisible();
      await expect(panel(page).getByTestId("member-admin-actions")).toHaveCount(0);
      await expect.poll(async () => (await memberAdminEntry(admin, firstId, user.email))?.membershipId ?? null, { message: "left the first org" }).toBeNull();
      expect(await memberAdminEntry(admin, secondId, user.email), "member of the second org").toMatchObject({ role: "MEMBER", otherOrgs: [linkPlace.orgName] });

      // Remove, on the second org's page: two clicks, the first only arms the button
      await openManagePage(page, secondId);
      await pickMember(page, user.email);
      const remove = panel(page).getByTestId("member-admin-remove");
      await expect(remove).toContainText("org_groups.member_admin.remove");
      await remove.click();
      await expect(remove).toHaveText("org_groups.confirm_delete");
      expect((await memberAdminEntry(admin, secondId, user.email))?.membershipId, "still a member after the first click").toBeTruthy();
      expect(await membershipRequest(page, "DELETE", () => remove.click())).toBe(200);
      await expect(successToast(page, "org_groups.member_admin.removed_toast")).toBeVisible();
      await expect.poll(async () => (await memberAdminEntry(admin, secondId, user.email))?.membershipId ?? null, { message: "left the second org" }).toBeNull();
    }
    finally {
      // Whatever the test left behind in the two seeded orgs
      for (const orgId of [firstId, secondId]) {
        const entry = await memberAdminEntry(admin, orgId, user.email).catch(() => null);
        if (entry?.membershipId) await admin.delete("/api/org-membership", { data: { membershipId: entry.membershipId } }).catch(() => null);
      }
      await user.request.dispose();
    }
  });

  test("picking an org's only manager warns before they are moved or removed", async ({ page, admin }) => {
    test.setTimeout(120_000);
    await openManagePage(page, await orgIdByName(admin, firstOrg));
    await pickSingleSearchOption(page, "member-admin-member", firstOrgManager);
    await expect(panel(page).getByTestId("member-admin-last-manager")).toContainText("org_groups.member_admin.last_manager_warning");
    // A move keeps the role unless another is chosen
    await expect(panel(page).getByTestId("member-admin-move-role")).toHaveValue("MANAGER");
  });
});

test.describe("Membership administration is for super admins only", () => {
  test("a manager manages the org without it", async ({ browser, admin }) => {
    test.setTimeout(120_000);
    const context = await memberContext(browser, firstOrgManager);
    const page = await context.newPage();
    try {
      await openManagePage(page, await orgIdByName(admin, firstOrg));
      // The manager's own tools are there
      await page.getByTestId("members-details").filter({ visible: true }).locator("summary").click();
      await expect(page.getByTestId("member-role").filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByTestId("member-admin")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });

  test("a super admin with the powers off manages their own org without it", async ({ browser, admin }) => {
    test.setTimeout(120_000);
    // Its own login: the switch lives in the session cookie
    const context = await loginContext(browser, Seed.admin.username);
    const page = await context.newPage();
    try {
      const orgId = await orgIdByName(admin, Seed.orgName);
      await openManagePage(page, orgId);
      await expect(panel(page)).toBeVisible();

      const suspend = await context.request.post("/api/user/privileges", { data: { superAdmin: false } });
      expect(suspend.status(), await suspend.text()).toBe(200);
      await openManagePage(page, orgId);
      await expect(page.getByTestId("member-admin")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });
});
