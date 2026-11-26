import path from "node:path";
import { cwd } from "node:process";
import type { APIRequestContext, Locator, Page } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { loginContext, memberAdminEntry, memberContext, orgIdByName, Seed } from "../lib/api";
import { pickSingleSearchOption, visible } from "../lib/forms";
import { linkPlace, newLinkUser, onboard } from "../lib/login-link";

/*
 * Membership administration on the org manage page (/org/<id>/groups), in two boxes:
 * - the manager box (`member-manage`): an org's ansvarig adds someone by their exact
 *   e-mail address, removes a member, and moves one to another org they manage;
 * - the super admin box (`member-admin`), only with the powers on: pick from every
 *   user, move a member to any org.
 *
 * The users acted on are accounts of the test's own, made through the mailed-link
 * flow (enrolled in "Bodens kommun" by their address), so the browser projects never
 * race over a seeded user and nothing seeded changes. The access rules and the rest
 * of the contract are in tests/api/org-membership.spec.ts.
 */

const adminFile = path.join(cwd(), "tests/.auth/admin.json");

const firstOrg = "Kiruna kommun";
const secondOrg = "Region Norrbotten";
/** The first org's seeded manager (of that org only) and member */
const firstOrgManager = "Lars Niia";
const firstOrgMember = "Fatima Ali";

type Box = "member-manage" | "member-admin";

/** The super admin box */
function panel(page: Page): Locator {
  return page.getByTestId("member-admin").filter({ visible: true });
}

/** The manager box */
function managerBox(page: Page): Locator {
  return page.getByTestId("member-manage").filter({ visible: true });
}

function box(page: Page, which: Box): Locator {
  return which === "member-admin" ? panel(page) : managerBox(page);
}

/** A name no other run or browser project shares, so a member can be picked by it */
function uniqueName(first: string): { firstName: string, lastName: string } {
  return { firstName: first, lastName: `Test${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
}

/** Takes the test's user out of the seeded orgs it may have been left in; cleanup, so it never fails a test */
async function leaveOrgs(admin: APIRequestContext, orgIds: string[], email: string) {
  for (const orgId of orgIds) {
    const entry = await memberAdminEntry(admin, orgId, email).catch(() => null);
    if (entry?.membershipId) await admin.delete("/api/org-membership", { data: { membershipId: entry.membershipId } }).catch(() => null);
  }
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

function toast(page: Page, kind: "status" | "alert", key: string): Locator {
  return page.getByTestId("toast-list").locator(`dialog[role="${kind}"]`).filter({ hasText: key });
}

/**
 * Picks the org's member whose option carries `text` (a name; for super admins also an
 * address) once the list has it: the list comes back through router.refresh(), so right
 * after a change the first look may be the old one.
 */
async function pickMember(page: Page, which: Box, text: string) {
  await expect(async () => {
    await pickSingleSearchOption(page, `${which}-member`, text);
    await expect(box(page, which).getByTestId(`${which}-actions`)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await expect(visible(page, `#${which}-member`)).toContainText(text);
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
      // What an ansvarig may do is there for the super admin too, in its own box
      await expect(managerBox(page)).toBeVisible();

      // Add: found by address among everyone outside the org; nothing to send until someone is picked
      const add = panel(page).getByTestId("member-admin-add-submit");
      await expect(add).toBeDisabled();
      await pickSingleSearchOption(page, "member-admin-user", user.email);
      // The option says where the user belongs today
      await expect(visible(page, "#member-admin-user")).toContainText(linkPlace.orgName);
      expect(await membershipRequest(page, "POST", () => add.click())).toBe(201);
      await expect(toast(page, "status", "org_groups.member_admin.added_toast")).toBeVisible();
      // The select is cleared for the next one
      await expect(visible(page, "#member-admin-user")).not.toContainText(user.email);
      await expect(add).toBeDisabled();

      // Move: the new member is in the org's list; a target has to be picked first
      await pickMember(page, "member-admin", user.email);
      const move = panel(page).getByTestId("member-admin-move-submit");
      await expect(move).toBeDisabled();
      // A plain member among others is no last manager
      await expect(panel(page).getByTestId("member-admin-last-manager")).toHaveCount(0);
      await pickSingleSearchOption(page, "member-admin-target", secondOrg);
      expect(await membershipRequest(page, "PATCH", () => move.click())).toBe(200);
      await expect(toast(page, "status", "org_groups.member_admin.moved_toast")).toBeVisible();
      await expect(panel(page).getByTestId("member-admin-actions")).toHaveCount(0);
      await expect.poll(async () => (await memberAdminEntry(admin, firstId, user.email))?.membershipId ?? null, { message: "left the first org" }).toBeNull();
      expect(await memberAdminEntry(admin, secondId, user.email), "member of the second org").toMatchObject({ role: "MEMBER", otherOrgs: [linkPlace.orgName] });

      // Remove, on the second org's page, in the manager box: two clicks, the first only arms the button
      await openManagePage(page, secondId);
      await pickMember(page, "member-manage", user.email);
      // The super admin moves anywhere from the other box, so this one offers no move
      await expect(managerBox(page).locator("#member-manage-target")).toHaveCount(0);
      const remove = managerBox(page).getByTestId("member-manage-remove");
      await expect(remove).toContainText("org_groups.member_admin.remove");
      await remove.click();
      await expect(remove).toHaveText("org_groups.confirm_delete");
      expect((await memberAdminEntry(admin, secondId, user.email))?.membershipId, "still a member after the first click").toBeTruthy();
      expect(await membershipRequest(page, "DELETE", () => remove.click())).toBe(200);
      await expect(toast(page, "status", "org_groups.member_admin.removed_toast")).toBeVisible();
      await expect.poll(async () => (await memberAdminEntry(admin, secondId, user.email))?.membershipId ?? null, { message: "left the second org" }).toBeNull();
    }
    finally {
      await leaveOrgs(admin, [firstId, secondId], user.email);
      await user.request.dispose();
    }
  });

  test("picking an org's only manager warns before they are moved or removed", async ({ page, admin }) => {
    test.setTimeout(120_000);
    await openManagePage(page, await orgIdByName(admin, firstOrg));
    await pickSingleSearchOption(page, "member-admin-member", firstOrgManager);
    await expect(panel(page).getByTestId("member-admin-last-manager")).toContainText("org_groups.member_admin.last_manager_warning");
    // The same warning before a removal, in the manager box
    await pickSingleSearchOption(page, "member-manage-member", firstOrgManager);
    await expect(managerBox(page).getByTestId("member-manage-last-manager")).toContainText("org_groups.member_admin.last_manager_warning");
    // A move keeps the role unless another is chosen
    await expect(panel(page).getByTestId("member-admin-move-role")).toHaveValue("MANAGER");
  });
});

test.describe("Membership administration as ansvarig", () => {
  test("an ansvarig adds a person by e-mail address, moves them to another org they manage and removes them", async ({ browser, admin, playwright, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    // Two accounts of the test's own: the ansvarig (of both orgs, for the occasion) and a colleague
    const [manager, colleague] = await Promise.all([
      newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-ui-ansvarig", false),
      newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-ui-colleague", false),
    ]);
    const managerName = uniqueName("Ansvarig");
    const colleagueName = uniqueName("Kollega");
    await Promise.all([onboard(manager.request, managerName), onboard(colleague.request, colleagueName)]);
    const colleagueLabel = `${colleagueName.firstName} ${colleagueName.lastName}`;
    const [firstId, secondId] = await Promise.all([orgIdByName(admin, firstOrg), orgIdByName(admin, secondOrg)]);
    // The browser signs in with the session the link flow gave the ansvarig
    const context = await browser.newContext({ storageState: await manager.request.storageState() });
    const page = await context.newPage();
    try {
      const managerId = (await memberAdminEntry(admin, firstId, manager.email))?.userId;
      for (const orgId of [firstId, secondId]) {
        const response = await admin.post("/api/org-membership", { data: { orgId, userId: managerId, role: "MANAGER" } });
        expect(response.status(), await response.text()).toBe(201);
      }

      await openManagePage(page, firstId);
      await expect(managerBox(page)).toContainText("org_groups.member_admin.manage_heading");
      // No user list and no moving to any org: that box is the super admin's
      await expect(page.getByTestId("member-admin")).toHaveCount(0);

      // An address nobody has an account for: the answer says so, and nothing is added
      const email = managerBox(page).getByTestId("member-manage-email");
      const add = managerBox(page).getByTestId("member-manage-add-submit");
      await expect(add).toBeDisabled();
      await email.fill(`nobody.${Date.now().toString(36)}@${linkPlace.domain}`);
      expect(await membershipRequest(page, "POST", () => add.click())).toBe(404);
      await expect(toast(page, "alert", "orgMembership.no_account")).toBeVisible();

      // The colleague's exact address
      await email.fill(colleague.email);
      expect(await membershipRequest(page, "POST", () => add.click())).toBe(201);
      await expect(toast(page, "status", "org_groups.member_admin.added_toast")).toBeVisible();
      await expect(email).toHaveValue("");

      // The ansvarig finds members by name: no addresses, and not themselves
      await pickMember(page, "member-manage", colleagueLabel);
      await expect(visible(page, "#member-manage-member")).not.toContainText(colleague.email);
      await expect(managerBox(page)).toContainText("org_groups.member_admin.own_membership_hint");
      await visible(page, "#member-manage-member").click();
      const members = visible(page, "#member-manage-member-dialog-listbox").locator("li");
      await expect(members.filter({ hasText: colleagueLabel })).toHaveCount(1);
      await expect(members.filter({ hasText: managerName.lastName })).toHaveCount(0);
      await page.keyboard.press("Escape");

      // Move: only the other org they manage is on offer
      await visible(page, "#member-manage-target").click();
      const targets = visible(page, "#member-manage-target-dialog-listbox").locator("li");
      await expect(targets).toHaveCount(1);
      await expect(targets).toHaveText(secondOrg);
      await targets.click();
      expect(await membershipRequest(page, "PATCH", () => managerBox(page).getByTestId("member-manage-move-submit").click())).toBe(200);
      await expect(toast(page, "status", "org_groups.member_admin.moved_toast")).toBeVisible();
      await expect.poll(async () => (await memberAdminEntry(admin, firstId, colleague.email))?.membershipId ?? null, { message: "left the first org" }).toBeNull();
      expect(await memberAdminEntry(admin, secondId, colleague.email), "member of the second org").toMatchObject({ role: "MEMBER" });

      // Remove, on the second org's page: two clicks
      await openManagePage(page, secondId);
      await pickMember(page, "member-manage", colleagueLabel);
      const remove = managerBox(page).getByTestId("member-manage-remove");
      await remove.click();
      await expect(remove).toHaveText("org_groups.confirm_delete");
      expect(await membershipRequest(page, "DELETE", () => remove.click())).toBe(200);
      await expect(toast(page, "status", "org_groups.member_admin.removed_toast")).toBeVisible();
      await expect.poll(async () => (await memberAdminEntry(admin, secondId, colleague.email))?.membershipId ?? null, { message: "left the second org" }).toBeNull();
    }
    finally {
      await context.close();
      await leaveOrgs(admin, [firstId, secondId], manager.email);
      await leaveOrgs(admin, [firstId, secondId], colleague.email);
      await Promise.all([manager.request, colleague.request].map(request => request.dispose()));
    }
  });

  test("an ansvarig of one org gets the manager box without a move, and no super admin box", async ({ browser, admin }) => {
    test.setTimeout(120_000);
    const context = await memberContext(browser, firstOrgManager);
    const page = await context.newPage();
    try {
      await openManagePage(page, await orgIdByName(admin, firstOrg));
      // The role selects are still there
      await page.getByTestId("members-details").filter({ visible: true }).locator("summary").click();
      await expect(page.getByTestId("member-role").filter({ visible: true }).first()).toBeVisible();

      await expect(managerBox(page)).toBeVisible();
      await expect(page.getByTestId("member-admin")).toHaveCount(0);
      // Nowhere to move anyone: this ansvarig manages no other org (nothing is clicked through here)
      await pickSingleSearchOption(page, "member-manage-member", firstOrgMember);
      await expect(managerBox(page).getByTestId("member-manage-remove")).toBeVisible();
      await expect(managerBox(page).locator("#member-manage-target")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });

  test("a super admin with the powers off is the ansvarig of their own org and no more", async ({ browser, admin }) => {
    test.setTimeout(120_000);
    // Its own login: the switch lives in the session cookie
    const context = await loginContext(browser, Seed.admin.username);
    const page = await context.newPage();
    try {
      const orgId = await orgIdByName(admin, Seed.orgName);
      await openManagePage(page, orgId);
      await expect(panel(page)).toBeVisible();
      await expect(managerBox(page)).toBeVisible();

      const suspend = await context.request.post("/api/user/privileges", { data: { superAdmin: false } });
      expect(suspend.status(), await suspend.text()).toBe(200);
      await openManagePage(page, orgId);
      await expect(managerBox(page)).toBeVisible();
      await expect(page.getByTestId("member-admin")).toHaveCount(0);
    }
    finally {
      await context.close();
    }
  });
});
