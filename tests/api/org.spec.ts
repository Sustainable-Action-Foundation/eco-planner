import type { APIRequestContext } from "playwright/test";
import { expect, test as base } from "../lib/fixtures";
import { groupIdByName, membershipIdByUsername, membershipRole, orgIdByName, pageEntity, putJson, requestAs, Seed, uniqueLabel } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * Org management: /api/org (rename, geo area), /api/org-membership (roles) and
 * /api/group (CRUD). Managers of the org and super admins may; members and
 * strangers get a 404 (the org's existence is not leaked) or a 403 on create.
 *
 * Every mutation here targets the seeded place org "Göteborgs stad" (manager
 * Elin Ekström, member Ali Rahimi, admin is not a member) and is restored in
 * `finally`, so the three groups below run serially in this one file and no
 * other spec touches that org.
 */

const org = {
  name: "Göteborgs stad",
  areaCode: "1480",
  manager: memberSlug("Elin Ekström"),
  member: memberSlug("Ali Rahimi"),
};

type Actors = {
  anonymous: APIRequestContext;
  orgless: APIRequestContext;
  /** Elin, manager of the org */
  manager: APIRequestContext;
  /** Ali, plain member of the org */
  member: APIRequestContext;
};

const test = base.extend<{ actors: Actors }>({
  actors: async ({ playwright, baseURL }, use) => {
    const [anonymous, orgless, manager, member] = await Promise.all([
      requestAs(playwright, baseURL),
      requestAs(playwright, baseURL, Seed.orgless.username, Seed.orgless.password),
      requestAs(playwright, baseURL, org.manager, Seed.memberPassword),
      requestAs(playwright, baseURL, org.member, Seed.memberPassword),
    ]);
    await use({ anonymous, orgless, manager, member });
    await Promise.all([anonymous, orgless, manager, member].map(request => request.dispose()));
  },
});

async function expectStatus(request: APIRequestContext, method: "post" | "put" | "delete", url: string, data: unknown, expected: number, who: string): Promise<void> {
  const response = await request[method](url, { data });
  expect(response.status(), `${who}: ${method.toUpperCase()} ${url} -> ${await response.text()}`).toBe(expected);
}

/**
 * Retries a page read-back after a write: the first read after an
 * expire-0 revalidation was observed to still serve the cached render.
 */
async function eventually(check: () => Promise<unknown>): Promise<void> {
  await expect(check).toPass({ timeout: 20_000 });
}

/** The membership ids of a group, off the groups page payload (`{ id, name, memberIds }`) */
async function groupMemberIds(request: APIRequestContext, orgId: string, groupId: string): Promise<string[]> {
  const orgGroups = await pageEntity(request, `/org/${orgId}/groups`, groupId);
  expect(orgGroups, `group ${groupId} on the groups page`).toBeTruthy();
  return [...(orgGroups?.memberIds as string[] | undefined ?? [])].sort();
}

// One org, one worker: every mutation below is restored in `finally`
test.describe.serial(`mutations of ${org.name}`, () => {
  let orgId = "";

  test.beforeEach(async ({ admin }) => {
    // Super admins get every org in the start page switcher
    orgId ||= await orgIdByName(admin, org.name);
  });

  test.describe("/api/org", () => {
    test("a manager renames the org and the name is restored", async ({ actors }, testInfo) => {
      const newName = `${org.name} ${uniqueLabel(testInfo, "renamed")}`;
      try {
        await putJson(actors.manager, "/api/org", { orgId, name: newName });
        // The new name reaches the manager's own start page switcher
        await eventually(async () => expect(await orgIdByName(actors.manager, newName)).toBe(orgId));
      }
      finally {
        await putJson(actors.manager, "/api/org", { orgId, name: org.name });
      }
      await eventually(async () => expect(await orgIdByName(actors.manager, org.name)).toBe(orgId));
    });

    test("a name another org holds is a 409", async ({ actors }) => {
      await expectStatus(actors.manager, "put", "/api/org", { orgId, name: "Malmö stad" }, 409, "manager");
      expect(await orgIdByName(actors.manager, org.name), "unchanged").toBe(orgId);
    });

    test("a manager moves the org between areas; an unknown code is a 400", async ({ actors }) => {
      try {
        await putJson(actors.manager, "/api/org", { orgId, geoAreaCode: "1280" });
        await expectStatus(actors.manager, "put", "/api/org", { orgId, geoAreaCode: "9999" }, 400, "manager, unknown area");
        await putJson(actors.manager, "/api/org", { orgId, geoAreaCode: null });
      }
      finally {
        await putJson(actors.manager, "/api/org", { orgId, geoAreaCode: org.areaCode });
      }
    });

    test("a super admin manages an org they are no member of", async ({ admin }) => {
      await putJson(admin, "/api/org", { orgId, geoAreaCode: org.areaCode });
    });

    test("a body with neither name nor area, or a blank name, is a 400", async ({ actors }) => {
      await expectStatus(actors.manager, "put", "/api/org", { orgId }, 400, "manager");
      await expectStatus(actors.manager, "put", "/api/org", { orgId, name: "   " }, 400, "manager");
      await expectStatus(actors.manager, "put", "/api/org", { name: "x" }, 400, "manager, no orgId");
    });

    test("members, strangers and anonymous visitors cannot rename", async ({ actors }) => {
      const body = { orgId, name: `${org.name} hijacked` };
      await expectStatus(actors.anonymous, "put", "/api/org", body, 401, "anonymous");
      await expectStatus(actors.orgless, "put", "/api/org", body, 404, "orgless");
      await expectStatus(actors.member, "put", "/api/org", body, 404, "member");
      await expectStatus(actors.manager, "put", "/api/org", { orgId: "00000000-0000-0000-0000-000000000000", name: "x" }, 404, "manager, unknown org");
      expect(await orgIdByName(actors.manager, org.name), "unchanged").toBe(orgId);
    });
  });

  test.describe("/api/org-membership", () => {
    test("a manager promotes a member and demotes them again", async ({ actors }) => {
      const membershipId = await membershipIdByUsername(actors.manager, orgId, org.member);
      await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.member)).toBe("MEMBER"));
      try {
        await putJson(actors.manager, "/api/org-membership", { membershipId, role: "MANAGER" });
        await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.member)).toBe("MANAGER"));
        // The new manager can now read the management page too
        await eventually(async () => expect(await membershipRole(actors.member, orgId, org.manager)).toBe("MANAGER"));
      }
      finally {
        await putJson(actors.manager, "/api/org-membership", { membershipId, role: "MEMBER" });
      }
      await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.member)).toBe("MEMBER"));
    });

    test("nobody changes their own role", async ({ actors }) => {
      const own = await membershipIdByUsername(actors.manager, orgId, org.manager);
      await expectStatus(actors.manager, "put", "/api/org-membership", { membershipId: own, role: "MEMBER" }, 400, "manager, own role");
      await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.manager)).toBe("MANAGER"));
    });

    test("only MEMBER and MANAGER are roles the route sets", async ({ actors }) => {
      const membershipId = await membershipIdByUsername(actors.manager, orgId, org.member);
      await expectStatus(actors.manager, "put", "/api/org-membership", { membershipId, role: "GUEST" }, 400, "manager, GUEST");
      await expectStatus(actors.manager, "put", "/api/org-membership", { membershipId, role: "OWNER" }, 400, "manager, OWNER");
      await expectStatus(actors.manager, "put", "/api/org-membership", { role: "MANAGER" }, 400, "manager, no membership");
      await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.member)).toBe("MEMBER"));
    });

    test("a super admin promotes and demotes without a membership of their own", async ({ admin }) => {
      const membershipId = await membershipIdByUsername(admin, orgId, org.member);
      try {
        await putJson(admin, "/api/org-membership", { membershipId, role: "MANAGER" });
        await eventually(async () => expect(await membershipRole(admin, orgId, org.member)).toBe("MANAGER"));
      }
      finally {
        await putJson(admin, "/api/org-membership", { membershipId, role: "MEMBER" });
      }
      await eventually(async () => expect(await membershipRole(admin, orgId, org.member)).toBe("MEMBER"));
    });

    test("members, strangers and anonymous visitors cannot change roles", async ({ actors }) => {
      const membershipId = await membershipIdByUsername(actors.manager, orgId, org.member);
      const body = { membershipId, role: "MANAGER" };
      await expectStatus(actors.anonymous, "put", "/api/org-membership", body, 401, "anonymous");
      await expectStatus(actors.orgless, "put", "/api/org-membership", body, 404, "orgless");
      await expectStatus(actors.member, "put", "/api/org-membership", body, 404, "member, own promotion");
      await expectStatus(actors.manager, "put", "/api/org-membership", { membershipId: "00000000-0000-0000-0000-000000000000", role: "MANAGER" }, 404, "manager, unknown membership");
      await eventually(async () => expect(await membershipRole(actors.manager, orgId, org.member)).toBe("MEMBER"));
    });
  });

  test.describe("/api/group", () => {
    test("a manager creates, renames, re-members and deletes a group", async ({ actors }, testInfo) => {
      const name = uniqueLabel(testInfo, "group");
      const renamed = `${name} renamed`;
      const memberId = await membershipIdByUsername(actors.manager, orgId, org.member);
      let groupId = "";
      try {
        const created = await actors.manager.post("/api/group", { data: { orgId, name, memberIds: [memberId] } });
        expect(created.status(), await created.text()).toBe(201);
        groupId = await groupIdByName(actors.manager, orgId, name);
        expect(await groupMemberIds(actors.manager, orgId, groupId), "members on create").toEqual([memberId]);

        await expectStatus(actors.manager, "post", "/api/group", { orgId, name }, 400, "manager, duplicate name");

        await putJson(actors.manager, "/api/group", { groupId, name: renamed, memberIds: [] });
        await eventually(async () => expect(await groupIdByName(actors.manager, orgId, renamed)).toBe(groupId));
        expect(await groupMemberIds(actors.manager, orgId, groupId), "members after the update").toEqual([]);
        await expectStatus(actors.manager, "put", "/api/group", { groupId, name: "" }, 400, "manager, blank name");
        await expectStatus(actors.manager, "put", "/api/group", { name: "x" }, 400, "manager, no groupId");
      }
      finally {
        if (groupId) {
          await expectStatus(actors.manager, "delete", "/api/group", { groupId }, 200, "manager");
        }
      }
      await expectStatus(actors.manager, "delete", "/api/group", { groupId }, 404, "manager, already deleted");
    });

    test("ids outside the org are dropped from the member set", async ({ actors, admin }, testInfo) => {
      const name = uniqueLabel(testInfo, "group");
      const foreignOrgId = await orgIdByName(admin, Seed.orgName);
      // The groups page lists usernames as stored ("Anita"); login is case-insensitive
      const foreignMembershipId = await membershipIdByUsername(admin, foreignOrgId, "Anita");
      const memberId = await membershipIdByUsername(actors.manager, orgId, org.member);
      let groupId = "";
      try {
        const created = await actors.manager.post("/api/group", { data: { orgId, name, memberIds: [foreignMembershipId, "not-an-id", memberId] } });
        expect(created.status(), await created.text()).toBe(201);
        groupId = await groupIdByName(actors.manager, orgId, name);
        expect(await groupMemberIds(actors.manager, orgId, groupId), "only the org's own membership is kept").toEqual([memberId]);
      }
      finally {
        if (groupId) await expectStatus(actors.manager, "delete", "/api/group", { groupId }, 200, "manager");
      }
    });

    test("a super admin manages groups in an org they are no member of", async ({ admin }, testInfo) => {
      const name = uniqueLabel(testInfo, "group");
      let groupId = "";
      try {
        const created = await admin.post("/api/group", { data: { orgId, name } });
        expect(created.status(), await created.text()).toBe(201);
        groupId = await groupIdByName(admin, orgId, name);
        await putJson(admin, "/api/group", { groupId, name: `${name} 2` });
      }
      finally {
        if (groupId) await expectStatus(admin, "delete", "/api/group", { groupId }, 200, "super admin");
      }
    });

    test("members, strangers and anonymous visitors cannot touch groups", async ({ actors }, testInfo) => {
      const name = uniqueLabel(testInfo, "group");
      let groupId = "";
      try {
        const created = await actors.manager.post("/api/group", { data: { orgId, name } });
        expect(created.status(), await created.text()).toBe(201);
        groupId = await groupIdByName(actors.manager, orgId, name);

        await expectStatus(actors.anonymous, "post", "/api/group", { orgId, name: `${name} anon` }, 401, "anonymous");
        await expectStatus(actors.orgless, "post", "/api/group", { orgId, name: `${name} orgless` }, 403, "orgless");
        await expectStatus(actors.member, "post", "/api/group", { orgId, name: `${name} member` }, 403, "member");
        await expectStatus(actors.manager, "post", "/api/group", { orgId, name: "" }, 400, "manager, blank name");

        await expectStatus(actors.anonymous, "put", "/api/group", { groupId, name: "hijacked" }, 401, "anonymous");
        await expectStatus(actors.orgless, "put", "/api/group", { groupId, name: "hijacked" }, 404, "orgless");
        await expectStatus(actors.member, "put", "/api/group", { groupId, name: "hijacked" }, 404, "member");

        await expectStatus(actors.anonymous, "delete", "/api/group", { groupId }, 401, "anonymous");
        await expectStatus(actors.orgless, "delete", "/api/group", { groupId }, 404, "orgless");
        await expectStatus(actors.member, "delete", "/api/group", { groupId }, 404, "member");
        await expectStatus(actors.manager, "delete", "/api/group", { groupId: "00000000-0000-0000-0000-000000000000" }, 404, "manager, unknown group");

        expect(await groupIdByName(actors.manager, orgId, name), "still there under its name").toBe(groupId);
      }
      finally {
        if (groupId) await expectStatus(actors.manager, "delete", "/api/group", { groupId }, 200, "manager");
      }
    });
  });
});
