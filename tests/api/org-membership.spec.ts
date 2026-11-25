import type { APIRequestContext } from "playwright/test";
import { expect, test as base } from "../lib/fixtures";
import { createRoadmap, deleteRoadmap, expectPageStatus, flightPayload, memberAdminEntry, orgIdByName, pageStatus, requestAs, Seed, uniqueLabel } from "../lib/api";
import { freshContext, linkLogin, linkPlace, newLinkUser } from "../lib/login-link";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * Membership administration: POST (add an existing user), DELETE (remove a member)
 * and PATCH (move a member to another org) on /api/org-membership. Super admins
 * with their powers on only; the role route (PUT) is covered by org.spec.ts.
 *
 * No seeded user is ever added, removed or moved. Every test makes its own account
 * through the mailed-link flow under boden.se, which enrols it in "Bodens kommun"
 * like any real first login, and takes it out of the other orgs again when done.
 * "Region Norrbotten" (manager Ingrid Dahl, member Petter Lund) lends the roles that
 * must be refused; nothing about it changes.
 */

const home = linkPlace.orgName;
const other = "Kiruna kommun";
const refusing = {
  org: "Region Norrbotten",
  manager: memberSlug("Ingrid Dahl"),
  member: memberSlug("Petter Lund"),
  memberEmail: "petter.lund@norrbotten.se",
};
const unknownId = "00000000-0000-0000-0000-000000000000";

type Orgs = { home: string, other: string, refusing: string, fixtures: string };

const test = base.extend<{ orgs: Orgs }>({
  orgs: async ({ admin }, use) => {
    // Super admins get every org in the start page switcher
    const [homeId, otherId, refusingId, fixturesId] = await Promise.all([home, other, refusing.org, Seed.orgName].map(name => orgIdByName(admin, name)));
    await use({ home: homeId, other: otherId, refusing: refusingId, fixtures: fixturesId });
  },
});

async function send(request: APIRequestContext, method: "post" | "delete" | "patch", data: unknown, expected: number, who: string): Promise<{ id?: string }> {
  const response = await request[method]("/api/org-membership", { data });
  expect(response.status(), `${who}: ${method.toUpperCase()} /api/org-membership -> ${await response.text()}`).toBe(expected);
  return await response.json() as { id?: string };
}

/** The user's id, read off an org they are not a member of */
async function userIdOf(admin: APIRequestContext, orgId: string, email: string): Promise<string> {
  const entry = await memberAdminEntry(admin, orgId, email);
  expect(entry?.userId, `${email} among the users that can be added to org ${orgId}`).toBeTruthy();
  return entry?.userId ?? "";
}

/** The user's membership id in an org they belong to */
async function membershipIdOf(admin: APIRequestContext, orgId: string, email: string): Promise<string> {
  const entry = await memberAdminEntry(admin, orgId, email);
  expect(entry?.membershipId, `${email} among the members of org ${orgId}`).toBeTruthy();
  return entry?.membershipId ?? "";
}

/** A roadmap only the org's members read (and its managers and super admins) */
async function orgSharedRoadmap(admin: APIRequestContext, orgId: string, name: string): Promise<string> {
  return createRoadmap(admin, orgId, { name, access: { sharing: "ORG", grants: [] } });
}

/** Takes the user out of every org but the one their address enrolled them in; cleanup, so it never fails a test */
async function leaveOtherOrgs(admin: APIRequestContext, orgs: Orgs, email: string): Promise<void> {
  for (const orgId of [orgs.other, orgs.refusing, orgs.fixtures]) {
    const entry = await memberAdminEntry(admin, orgId, email).catch(() => null);
    if (entry?.membershipId) {
      await admin.delete("/api/org-membership", { data: { membershipId: entry.membershipId } }).catch(() => null);
    }
  }
}

test.describe("/api/org-membership: add, remove, move", () => {
  // Each test signs a new account up through the mail stub and reads large management pages
  test.describe.configure({ timeout: 240_000 });

  test("a super admin adds an existing user and removes them again; the org's non-public content follows", async ({ admin, orgs, playwright, baseURL }, testInfo) => {
    const label = uniqueLabel(testInfo, "add");
    const user = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-add");
    const roadmapId = await orgSharedRoadmap(admin, orgs.other, `Org only ${label}`);
    const page = `/roadmap/${roadmapId}`;
    try {
      expect(await pageStatus(user.request, page), "before joining").toBe(404);

      const userId = await userIdOf(admin, orgs.other, user.email);
      const { id: membershipId } = await send(admin, "post", { orgId: orgs.other, userId }, 201, "super admin");
      expect(membershipId, "the new membership's id").toBeTruthy();
      // No new login: the user's very next request sees the org's content
      await expectPageStatus(user.request, page, 200);
      const listed = await memberAdminEntry(admin, orgs.other, user.email);
      expect(listed, "listed as a member").toMatchObject({ membershipId, role: "MEMBER", otherOrgs: [home] });

      await send(admin, "post", { orgId: orgs.other, userId }, 409, "super admin, already a member");

      await send(admin, "delete", { membershipId }, 200, "super admin");
      await expectPageStatus(user.request, page, 404);
      await send(admin, "delete", { membershipId }, 404, "super admin, already removed");
      expect((await memberAdminEntry(admin, orgs.other, user.email))?.userId, "back among the users that can be added").toBe(userId);
    }
    finally {
      await leaveOtherOrgs(admin, orgs, user.email);
      await deleteRoadmap(admin, roadmapId);
      await user.request.dispose();
    }
  });

  test("a move takes the old org's non-public content away and gives the new org's", async ({ admin, orgs, playwright, baseURL }, testInfo) => {
    const label = uniqueLabel(testInfo, "move");
    const user = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-move");
    const [homeRoadmap, otherRoadmap] = await Promise.all([
      orgSharedRoadmap(admin, orgs.home, `Home only ${label}`),
      orgSharedRoadmap(admin, orgs.other, `Other only ${label}`),
    ]);
    try {
      // The address enrolled the account in its domain's org
      expect(await pageStatus(user.request, `/roadmap/${homeRoadmap}`), "home org before").toBe(200);
      expect(await pageStatus(user.request, `/roadmap/${otherRoadmap}`), "other org before").toBe(404);

      const homeMembershipId = await membershipIdOf(admin, orgs.home, user.email);
      await send(admin, "patch", { membershipId: homeMembershipId, orgId: orgs.home }, 400, "super admin, same org");
      await send(admin, "patch", { membershipId: homeMembershipId, orgId: unknownId }, 404, "super admin, unknown org");
      await send(admin, "patch", { membershipId: homeMembershipId, orgId: orgs.other, role: "GUEST" }, 400, "super admin, GUEST");

      const { id: movedId } = await send(admin, "patch", { membershipId: homeMembershipId, orgId: orgs.other }, 200, "super admin");
      expect(movedId, "the membership in the new org").toBeTruthy();
      await expectPageStatus(user.request, `/roadmap/${homeRoadmap}`, 404);
      await expectPageStatus(user.request, `/roadmap/${otherRoadmap}`, 200);
      // One membership, in the new org, with the role it had
      expect(await memberAdminEntry(admin, orgs.other, user.email)).toMatchObject({ membershipId: movedId, role: "MEMBER", otherOrgs: [] });
      expect((await memberAdminEntry(admin, orgs.home, user.email))?.membershipId, "no membership left in the old org").toBeUndefined();
      await send(admin, "patch", { membershipId: homeMembershipId, orgId: orgs.other }, 404, "super admin, the old membership is gone");

      // Moving onto an existing membership is refused instead of merging the two
      const userId = await userIdOf(admin, orgs.refusing, user.email);
      const { id: secondId } = await send(admin, "post", { orgId: orgs.refusing, userId }, 201, "super admin");
      await send(admin, "patch", { membershipId: movedId, orgId: orgs.refusing }, 409, "super admin, already a member of the target");
      await send(admin, "delete", { membershipId: secondId }, 200, "super admin");

      // Back home with another role: a manager now reads the org's management page
      expect(await pageStatus(user.request, `/org/${orgs.home}/groups`), "management page as a member elsewhere").toBe(404);
      const { id: backId } = await send(admin, "patch", { membershipId: movedId, orgId: orgs.home, role: "MANAGER" }, 200, "super admin, with a role");
      await expectPageStatus(user.request, `/org/${orgs.home}/groups`, 200);
      await expectPageStatus(user.request, `/roadmap/${otherRoadmap}`, 404);
      // And back to the plain member the address made them
      await send(admin, "delete", { membershipId: backId }, 200, "super admin");
      await send(admin, "post", { orgId: orgs.home, userId }, 201, "super admin");
      await expectPageStatus(user.request, `/org/${orgs.home}/groups`, 404);
    }
    finally {
      await leaveOtherOrgs(admin, orgs, user.email);
      await Promise.all([deleteRoadmap(admin, homeRoadmap), deleteRoadmap(admin, otherRoadmap)]);
      await user.request.dispose();
    }
  });

  test("a manual membership survives the next login: the address only enrols a new account", async ({ admin, orgs, playwright, baseURL }, testInfo) => {
    const label = uniqueLabel(testInfo, "sticky");
    const user = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-sticky");
    const [homeRoadmap, otherRoadmap] = await Promise.all([
      orgSharedRoadmap(admin, orgs.home, `Home only ${label}`),
      orgSharedRoadmap(admin, orgs.other, `Other only ${label}`),
    ]);
    /** Logs the same address in again through a new mailed link, as on another day and device */
    const loginAgain = async (): Promise<APIRequestContext> => {
      const request = await freshContext(playwright, baseURL, testInfo.workerIndex);
      await linkLogin(request, user.email);
      return request;
    };
    const later: APIRequestContext[] = [];
    try {
      expect(await pageStatus(user.request, `/roadmap/${homeRoadmap}`), "enrolled by the address").toBe(200);

      const { id: movedId } = await send(admin, "patch", { membershipId: await membershipIdOf(admin, orgs.home, user.email), orgId: orgs.other }, 200, "super admin");

      // A new login neither re-adds the user to the address's org nor drops the manual membership
      later.push(await loginAgain());
      await expectPageStatus(later[0], `/roadmap/${homeRoadmap}`, 404);
      await expectPageStatus(later[0], `/roadmap/${otherRoadmap}`, 200);
      expect(await memberAdminEntry(admin, orgs.other, user.email)).toMatchObject({ membershipId: movedId, otherOrgs: [] });

      // Nor is someone who was taken out of every org enrolled again
      await send(admin, "delete", { membershipId: movedId }, 200, "super admin");
      later.push(await loginAgain());
      await expectPageStatus(later[1], `/roadmap/${homeRoadmap}`, 404);
      await expectPageStatus(later[1], `/roadmap/${otherRoadmap}`, 404);
      expect(await memberAdminEntry(admin, orgs.home, user.email), "still outside the address's org").toMatchObject({ otherOrgs: [] });
      expect((await memberAdminEntry(admin, orgs.home, user.email))?.membershipId).toBeUndefined();
    }
    finally {
      await leaveOtherOrgs(admin, orgs, user.email);
      await Promise.all([deleteRoadmap(admin, homeRoadmap), deleteRoadmap(admin, otherRoadmap)]);
      await Promise.all([user.request, ...later].map(request => request.dispose()));
    }
  });

  test("a super admin with suspended powers, managers, members, strangers and anonymous visitors are refused", async ({ admin, orgs, playwright, baseURL }, testInfo) => {
    const user = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member-refused");
    const [anonymous, orgless, manager, member, suspended] = await Promise.all([
      requestAs(playwright, baseURL),
      requestAs(playwright, baseURL, Seed.orgless.username),
      requestAs(playwright, baseURL, refusing.manager),
      requestAs(playwright, baseURL, refusing.member),
      requestAs(playwright, baseURL, Seed.admin.username),
    ]);
    try {
      const userId = await userIdOf(admin, orgs.refusing, user.email);
      // A member of the manager's own org, and the outsider's membership at home
      const ownMember = await membershipIdOf(admin, orgs.refusing, refusing.memberEmail);
      const outsider = await membershipIdOf(admin, orgs.home, user.email);

      const suspend = await suspended.post("/api/user/privileges", { data: { superAdmin: false } });
      expect(suspend.status(), await suspend.text()).toBe(200);

      const add = { orgId: orgs.refusing, userId };
      const remove = { membershipId: ownMember };
      const moveOut = { membershipId: ownMember, orgId: orgs.other };
      const moveIn = { membershipId: outsider, orgId: orgs.refusing };

      await send(anonymous, "post", add, 401, "anonymous");
      await send(orgless, "post", add, 403, "orgless");
      await send(member, "post", add, 403, "member");
      // Managing the org is not enough: managers change roles, not who the members are
      await send(manager, "post", add, 403, "manager of the org");
      await send(suspended, "post", add, 403, "super admin, powers suspended");
      // Not even in the org the suspended super admin manages
      await send(suspended, "post", { orgId: orgs.fixtures, userId }, 403, "super admin, powers suspended, own org");
      for (const [method, data] of [["delete", remove], ["patch", moveOut], ["patch", moveIn]] as const) {
        await send(anonymous, method, data, 401, "anonymous");
        // 404 rather than 403: whether the membership exists is not theirs to learn
        await send(orgless, method, data, 404, "orgless");
        await send(member, method, data, 404, "member");
        await send(manager, method, data, 404, "manager of the org");
        await send(suspended, method, data, 404, "super admin, powers suspended");
      }

      // Nothing happened
      expect(await membershipIdOf(admin, orgs.refusing, refusing.memberEmail), "the member is where they were").toBe(ownMember);
      expect((await memberAdminEntry(admin, orgs.refusing, user.email))?.userId, "the outsider was not added").toBe(userId);
      expect(await membershipIdOf(admin, orgs.home, user.email), "nor moved").toBe(outsider);

      // With the powers back on the same session may
      const restore = await suspended.post("/api/user/privileges", { data: { superAdmin: true } });
      expect(restore.status(), await restore.text()).toBe(200);
      const { id } = await send(suspended, "post", add, 201, "super admin, powers restored");
      await send(suspended, "delete", { membershipId: id }, 200, "super admin, powers restored");
    }
    finally {
      await leaveOtherOrgs(admin, orgs, user.email);
      await Promise.all([anonymous, orgless, manager, member, suspended, user.request].map(request => request.dispose()));
    }
  });

  test("missing or unknown ids and roles that cannot be given are refused", async ({ admin, orgs }) => {
    const someone = await membershipIdOf(admin, orgs.refusing, refusing.memberEmail);

    await send(admin, "post", { orgId: orgs.other }, 400, "no userId");
    await send(admin, "post", { userId: unknownId }, 400, "no orgId");
    await send(admin, "post", { orgId: orgs.other, userId: unknownId }, 404, "unknown user");
    await send(admin, "post", { orgId: unknownId, userId: unknownId }, 404, "unknown org");
    await send(admin, "post", { orgId: orgs.other, userId: unknownId, role: "GUEST" }, 400, "GUEST");
    await send(admin, "post", { orgId: orgs.other, userId: unknownId, role: "OWNER" }, 400, "OWNER");
    await send(admin, "post", [orgs.other], 400, "an array");

    await send(admin, "delete", {}, 400, "no membershipId");
    await send(admin, "delete", { membershipId: unknownId }, 404, "unknown membership");

    await send(admin, "patch", { membershipId: someone }, 400, "no orgId");
    await send(admin, "patch", { orgId: orgs.other }, 400, "no membershipId");
    await send(admin, "patch", { membershipId: unknownId, orgId: orgs.other }, 404, "unknown membership");

    expect(await membershipIdOf(admin, orgs.refusing, refusing.memberEmail), "untouched").toBe(someone);
  });

  test("the management page only hands users and addresses to a super admin with powers on", async ({ admin, orgs, playwright, baseURL }) => {
    const [manager, suspended] = await Promise.all([
      requestAs(playwright, baseURL, refusing.manager),
      requestAs(playwright, baseURL, Seed.admin.username),
    ]);
    try {
      // An address from another org: only the list of users that can be added carries it
      const foreignEmail = "lars.niia@kiruna.se";

      const asAdmin = await flightPayload(admin, `/org/${orgs.refusing}/groups`);
      expect(asAdmin, "super admin").toContain('"candidates":');
      expect(asAdmin, "super admin").toContain(foreignEmail);

      // The manager manages the org and gets the page, without the administration
      const asManager = await flightPayload(manager, `/org/${orgs.refusing}/groups`);
      expect(asManager, "manager").toContain('"membershipId":');
      expect(asManager, "manager").not.toContain('"candidates":');
      expect(asManager, "manager").not.toContain(foreignEmail);
      expect(asManager, "manager: not even the own members' addresses").not.toContain(refusing.memberEmail);

      // The seeded admin manages the fixtures org; with the powers off he is its manager and no more
      const suspend = await suspended.post("/api/user/privileges", { data: { superAdmin: false } });
      expect(suspend.status(), await suspend.text()).toBe(200);
      const asSuspended = await flightPayload(suspended, `/org/${orgs.fixtures}/groups`);
      expect(asSuspended, "suspended super admin").toContain('"membershipId":');
      expect(asSuspended, "suspended super admin").not.toContain('"candidates":');
      expect(asSuspended, "suspended super admin").not.toContain(foreignEmail);
    }
    finally {
      await Promise.all([manager, suspended].map(request => request.dispose()));
    }
  });
});
