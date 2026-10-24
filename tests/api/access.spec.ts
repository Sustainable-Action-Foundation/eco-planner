import type { APIRequestContext } from "playwright/test";
import { expect, test as base } from "../lib/fixtures";
import { createAction, createEffect, createGoal, createIteration, createRoadmap, deleteRoadmap, expectPageStatus, flightPayload, freshTimestamp, groupIdByName, orgIdByName, pageRedirect, pageStatus, putJson, requestAs, Seed, uniqueLabel, yearlyDateValues } from "../lib/api";

/*
 * The access ladder (src/lib/accessChecker.ts) as seen through the API and the
 * page routes, per entity. Each test builds an ORG-shared roadmap in the fixtures
 * org with a grant to the seeded group, first RO and then RW, and walks the
 * same requests as five users:
 *
 *   anonymous  → pages 404, API 401
 *   orgless    → nothing (404 / 403)
 *   greta      → GUEST in the org and in the granted group; guests are disabled,
 *                so she sees and edits nothing beyond public content
 *   anita      → MEMBER in the org and in the group: ORG sharing / RO grant reads,
 *                RW grant edits, sharing settings stay manager-only
 *   admin      → super admin, everything
 *
 * Pages stream, so "can read" is `pageStatus` (reads the 404 digest), never
 * `response.status()`. Write bodies carry a fresh client timestamp so the
 * stale-data check (409) never shadows the access answer.
 */

type Users = {
  anonymous: APIRequestContext;
  orgless: APIRequestContext;
  greta: APIRequestContext;
  anita: APIRequestContext;
};

const test = base.extend<{ users: Users }>({
  users: async ({ playwright, baseURL }, use) => {
    const [anonymous, orgless, greta, anita] = await Promise.all([
      requestAs(playwright, baseURL),
      requestAs(playwright, baseURL, Seed.orgless.username),
      requestAs(playwright, baseURL, Seed.greta.username),
      requestAs(playwright, baseURL, Seed.anita.username),
    ]);
    await use({ anonymous, orgless, greta, anita });
    await Promise.all([anonymous, orgless, greta, anita].map(request => request.dispose()));
  },
});

type Shared = {
  roadmapId: string;
  /** Published */
  iterationId: string;
  /** Draft (version 2) */
  draftId: string;
  goalId: string;
  actionId: string;
};

type Level = "RO" | "RW";

/** An ORG-shared roadmap with a `level` grant to the seeded group, a published and a draft iteration, a goal, an action and an effect on it. */
async function buildShared(admin: APIRequestContext, orgId: string, groupId: string, label: string, level: Level): Promise<Shared> {
  const roadmapId = await createRoadmap(admin, orgId, { name: `Shared ${level} ${label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: level }] } });
  const iterationId = await createIteration(admin, roadmapId);
  const draftId = await createIteration(admin, roadmapId, { status: "DRAFT" });
  const goalId = await createGoal(admin, iterationId, { name: `Goal ${label}` });
  const actionId = await createAction(admin, iterationId, { name: `Action ${label}` });
  await createEffect(admin, goalId, actionId);
  return { roadmapId, iterationId, draftId, goalId, actionId };
}

/** Re-grants the group at `level` as admin (sharing settings are admin-only). */
async function setGrant(admin: APIRequestContext, roadmapId: string, groupId: string, level: Level): Promise<void> {
  await putJson(admin, "/api/roadmap", { id: roadmapId, access: { sharing: "ORG", grants: [{ groupId, accessLevel: level }] }, timestamp: freshTimestamp() });
}

async function expectStatus(request: APIRequestContext, method: "post" | "put" | "delete", url: string, data: unknown, expected: number, who: string): Promise<void> {
  const response = await request[method](url, { data });
  expect(response.status(), `${who}: ${method.toUpperCase()} ${url} -> ${await response.text()}`).toBe(expected);
}

test.describe("access ladder per entity", () => {
  // Dozens of streamed page reads per test on a shared dev server
  test.describe.configure({ timeout: 240_000 });

  let orgId = "";
  let groupId = "";

  test.beforeEach(async ({ admin }) => {
    orgId ||= await orgIdByName(admin, Seed.orgName);
    groupId ||= await groupIdByName(admin, orgId, Seed.groupName);
  });

  test("roadmap", async ({ admin, users }, testInfo) => {
    const label = uniqueLabel(testInfo, "access");
    const shared = await buildShared(admin, orgId, groupId, label, "RO");
    try {
      const page = `/roadmap/${shared.roadmapId}`;
      const rename = (who: string) => ({ id: shared.roadmapId, name: `Renamed by ${who} ${label}`, timestamp: freshTimestamp() });

      await test.step("ORG sharing: members read, nobody else", async () => {
        expect(await pageStatus(users.anonymous, page), "anonymous").toBe(404);
        expect(await pageStatus(users.orgless, page), "orgless").toBe(404);
        expect(await pageStatus(users.greta, page), "guest with RO grant").toBe(404);
        expect(await pageStatus(users.anita, page), "member").toBe(200);
        expect(await pageStatus(admin, page), "super admin").toBe(200);
      });

      await test.step("RO grant: no writes", async () => {
        await expectStatus(users.anonymous, "put", "/api/roadmap", rename("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "put", "/api/roadmap", rename("orgless"), 403, "orgless");
        await expectStatus(users.greta, "put", "/api/roadmap", rename("greta"), 403, "guest");
        await expectStatus(users.anita, "put", "/api/roadmap", rename("anita"), 403, "member with RO grant");
        await expectStatus(users.anita, "delete", "/api/roadmap", { id: shared.roadmapId }, 403, "member with RO grant");
      });

      await test.step("creating in the org takes a non-guest membership", async () => {
        const body = (name: string) => ({ name: `${name} ${label}`, description: "", type: "OTHER", actor: null, geoAreaCode: null, orgId, parentRoadmapId: null });
        await expectStatus(users.anonymous, "post", "/api/roadmap", body("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "post", "/api/roadmap", body("orgless"), 403, "orgless");
        await expectStatus(users.greta, "post", "/api/roadmap", body("greta"), 403, "guest");
      });

      await setGrant(admin, shared.roadmapId, groupId, "RW");

      await test.step("RW grant: the member edits content but not sharing; the guest still nothing", async () => {
        await putJson(users.anita, "/api/roadmap", rename("anita"));
        await expectStatus(users.anita, "put", "/api/roadmap", { ...rename("anita"), access: { sharing: "PUBLIC", grants: [] } }, 403, "member with RW grant changing sharing");
        await expectStatus(users.anita, "delete", "/api/roadmap", { id: shared.roadmapId }, 403, "member with RW grant deleting");
        await expectStatus(users.greta, "put", "/api/roadmap", rename("greta"), 403, "guest with RW grant");
        expect(await pageStatus(users.greta, page), "guest with RW grant").toBe(404);
        expect(await pageStatus(users.orgless, page), "orgless").toBe(404);
        await putJson(admin, "/api/roadmap", rename("admin"));
      });
    }
    finally {
      await deleteRoadmap(admin, shared.roadmapId);
    }
  });

  test("iteration, including drafts", async ({ admin, users }, testInfo) => {
    const label = uniqueLabel(testInfo, "access");
    const shared = await buildShared(admin, orgId, groupId, label, "RO");
    try {
      const published = `/roadmap/${shared.roadmapId}/v1`;
      const draft = `/roadmap/${shared.roadmapId}/v2`;
      const edit = (who: string) => ({ iterationId: shared.iterationId, description: `Edited by ${who} ${label}`, timestamp: freshTimestamp() });
      const create = { roadmapId: shared.roadmapId, description: null, targetVersion: null, status: "PUBLISHED", goals: null };

      await test.step("published version follows the roadmap; the draft needs edit access", async () => {
        expect(await pageStatus(users.anonymous, published), "anonymous").toBe(404);
        expect(await pageStatus(users.orgless, published), "orgless").toBe(404);
        expect(await pageStatus(users.greta, published), "guest").toBe(404);
        expect(await pageStatus(users.anita, published), "member").toBe(200);
        expect(await pageStatus(users.anita, draft), "member with RO grant, draft").toBe(404);
        expect(await pageStatus(users.anita, `/roadmap/${shared.roadmapId}/latest`), "member, latest alias").toBe(200);
        expect(await pageStatus(admin, draft), "super admin, draft").toBe(200);
      });

      await test.step("RO grant: no writes, no new versions", async () => {
        await expectStatus(users.anonymous, "put", "/api/roadmap-iteration", edit("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "put", "/api/roadmap-iteration", edit("orgless"), 403, "orgless");
        await expectStatus(users.greta, "put", "/api/roadmap-iteration", edit("greta"), 403, "guest");
        await expectStatus(users.anita, "put", "/api/roadmap-iteration", edit("anita"), 403, "member with RO grant");
        await expectStatus(users.anita, "put", "/api/roadmap-iteration", { ...edit("anita"), iterationId: shared.draftId }, 403, "member with RO grant, draft");
        await expectStatus(users.anonymous, "post", "/api/roadmap-iteration", create, 401, "anonymous");
        await expectStatus(users.orgless, "post", "/api/roadmap-iteration", create, 403, "orgless");
        await expectStatus(users.greta, "post", "/api/roadmap-iteration", create, 403, "guest");
        await expectStatus(users.anita, "post", "/api/roadmap-iteration", create, 403, "member with RO grant");
      });

      await setGrant(admin, shared.roadmapId, groupId, "RW");

      await test.step("RW grant: the member edits both versions and sees the draft", async () => {
        await putJson(users.anita, "/api/roadmap-iteration", edit("anita"));
        await putJson(users.anita, "/api/roadmap-iteration", { ...edit("anita"), iterationId: shared.draftId });
        // Polled: the first read after the grant change was observed to serve the cached 404
        await expectPageStatus(users.anita, draft, 200);
        expect(await pageStatus(users.greta, draft), "guest with RW grant, draft").toBe(404);
        await expectStatus(users.greta, "put", "/api/roadmap-iteration", edit("greta"), 403, "guest with RW grant");
        await putJson(admin, "/api/roadmap-iteration", edit("admin"));
      });
    }
    finally {
      await deleteRoadmap(admin, shared.roadmapId);
    }
  });

  test("goal", async ({ admin, users }, testInfo) => {
    const label = uniqueLabel(testInfo, "access");
    const shared = await buildShared(admin, orgId, groupId, label, "RO");
    try {
      const page = `/goal/${shared.goalId}`;
      const edit = (who: string) => ({ target: "FULL", goalId: shared.goalId, name: `Edited by ${who} ${label}`, timestamp: freshTimestamp() });
      const create = (who: string) => ({
        target: "FULL", iterationId: shared.iterationId, name: `Created by ${who} ${label}`, description: null, indicatorParameter: `Test\\${label}`, rawTags: null,
        dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3]) },
      });

      await test.step("ORG sharing: members read, nobody else", async () => {
        expect(await pageStatus(users.anonymous, page), "anonymous").toBe(404);
        expect(await pageStatus(users.orgless, page), "orgless").toBe(404);
        expect(await pageStatus(users.greta, page), "guest").toBe(404);
        expect(await pageStatus(users.anita, page), "member").toBe(200);
        expect(await pageStatus(admin, page), "super admin").toBe(200);
      });

      await test.step("RO grant: no writes", async () => {
        await expectStatus(users.anonymous, "put", "/api/goal", edit("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "put", "/api/goal", edit("orgless"), 403, "orgless");
        await expectStatus(users.greta, "put", "/api/goal", edit("greta"), 403, "guest");
        await expectStatus(users.anita, "put", "/api/goal", edit("anita"), 403, "member with RO grant");
        await expectStatus(users.anita, "delete", "/api/goal", { id: shared.goalId }, 403, "member with RO grant");
        await expectStatus(users.anonymous, "post", "/api/goal", create("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "post", "/api/goal", create("orgless"), 403, "orgless");
        await expectStatus(users.greta, "post", "/api/goal", create("greta"), 403, "guest");
        await expectStatus(users.anita, "post", "/api/goal", create("anita"), 403, "member with RO grant");
      });

      await setGrant(admin, shared.roadmapId, groupId, "RW");

      await test.step("RW grant: the member edits and creates; the guest still nothing", async () => {
        await putJson(users.anita, "/api/goal", edit("anita"));
        const created = await users.anita.post("/api/goal", { data: create("anita") });
        expect(created.status(), `member with RW grant creating: ${await created.text()}`).toBe(201);
        await expectStatus(users.greta, "put", "/api/goal", edit("greta"), 403, "guest with RW grant");
        expect(await pageStatus(users.greta, page), "guest with RW grant").toBe(404);
        await putJson(admin, "/api/goal", edit("admin"));
      });
    }
    finally {
      await deleteRoadmap(admin, shared.roadmapId);
    }
  });

  test("action", async ({ admin, users }, testInfo) => {
    const label = uniqueLabel(testInfo, "access");
    const shared = await buildShared(admin, orgId, groupId, label, "RO");
    try {
      const page = `/action/${shared.actionId}`;
      const edit = (who: string) => ({ actionId: shared.actionId, name: `Edited by ${who} ${label}`, timestamp: freshTimestamp() });
      const create = (who: string) => ({ iterationId: shared.iterationId, name: `Created by ${who} ${label}`, startYear: null, endYear: null, fields: [], parentActionId: null });

      await test.step("ORG sharing: members read, nobody else", async () => {
        expect(await pageStatus(users.anonymous, page), "anonymous").toBe(404);
        expect(await pageStatus(users.orgless, page), "orgless").toBe(404);
        expect(await pageStatus(users.greta, page), "guest").toBe(404);
        expect(await pageStatus(users.anita, page), "member").toBe(200);
        expect(await pageStatus(admin, page), "super admin").toBe(200);
      });

      await test.step("RO grant: no writes", async () => {
        await expectStatus(users.anonymous, "put", "/api/action", edit("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "put", "/api/action", edit("orgless"), 403, "orgless");
        await expectStatus(users.greta, "put", "/api/action", edit("greta"), 403, "guest");
        await expectStatus(users.anita, "put", "/api/action", edit("anita"), 403, "member with RO grant");
        await expectStatus(users.anita, "delete", "/api/action", { id: shared.actionId }, 403, "member with RO grant");
        await expectStatus(users.anonymous, "post", "/api/action", create("anonymous"), 401, "anonymous");
        await expectStatus(users.orgless, "post", "/api/action", create("orgless"), 403, "orgless");
        await expectStatus(users.greta, "post", "/api/action", create("greta"), 403, "guest");
        await expectStatus(users.anita, "post", "/api/action", create("anita"), 403, "member with RO grant");
      });

      await setGrant(admin, shared.roadmapId, groupId, "RW");

      await test.step("RW grant: the member edits and creates; the guest still nothing", async () => {
        await putJson(users.anita, "/api/action", edit("anita"));
        const created = await users.anita.post("/api/action", { data: create("anita") });
        expect(created.status(), `member with RW grant creating: ${await created.text()}`).toBe(201);
        await expectStatus(users.greta, "put", "/api/action", edit("greta"), 403, "guest with RW grant");
        expect(await pageStatus(users.greta, page), "guest with RW grant").toBe(404);
        await putJson(admin, "/api/action", edit("admin"));
      });
    }
    finally {
      await deleteRoadmap(admin, shared.roadmapId);
    }
  });

  test("effect", async ({ admin, users }, testInfo) => {
    const label = uniqueLabel(testInfo, "access");
    const shared = await buildShared(admin, orgId, groupId, label, "RO");
    try {
      // The effect has no page of its own: it renders on the goal page and is edited at /effect/<action>/<goal>/edit,
      // which answers a "no access" notice (not a 404) to readers without edit rights instead of the form
      const editPage = `/effect/${shared.actionId}/${shared.goalId}/edit`;
      const noAccess = async (request: APIRequestContext) => !(await flightPayload(request, editPage)).includes('"currentEffect":{');
      const edit = (values: number[]) => ({ actionId: shared.actionId, goalId: shared.goalId, dataSeries: { unit: "ton", dateValues: yearlyDateValues(values) }, timestamp: freshTimestamp() });

      // A second action to hang a new effect on
      const otherActionId = await createAction(admin, shared.iterationId, { name: `Other action ${label}` });
      const create = { actionId: otherActionId, goalId: shared.goalId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([2, 2, 2]) } };

      await test.step("the effect is visible with the goal and its edit page needs edit access", async () => {
        expect(await pageStatus(users.anita, `/goal/${shared.goalId}`), "member sees the goal (and its effects)").toBe(200);
        expect((await users.anita.get(`/goal/${shared.goalId}`)).ok()).toBe(true);
        expect(await pageRedirect(users.anonymous, editPage), "anonymous is sent to login").toContain("/login");
        expect(await noAccess(users.orgless), "orgless").toBe(true);
        expect(await noAccess(users.greta), "guest").toBe(true);
        expect(await noAccess(users.anita), "member with RO grant").toBe(true);
        expect(await noAccess(admin), "super admin").toBe(false);
      });

      await test.step("RO grant: no writes", async () => {
        await expectStatus(users.anonymous, "put", "/api/effect", edit([5, 5, 5]), 401, "anonymous");
        await expectStatus(users.orgless, "put", "/api/effect", edit([5, 5, 5]), 403, "orgless");
        await expectStatus(users.greta, "put", "/api/effect", edit([5, 5, 5]), 403, "guest");
        await expectStatus(users.anita, "put", "/api/effect", edit([5, 5, 5]), 403, "member with RO grant");
        await expectStatus(users.anita, "delete", "/api/effect", { actionId: shared.actionId, goalId: shared.goalId }, 403, "member with RO grant");
        await expectStatus(users.anonymous, "post", "/api/effect", create, 401, "anonymous");
        await expectStatus(users.orgless, "post", "/api/effect", create, 403, "orgless");
        await expectStatus(users.greta, "post", "/api/effect", create, 403, "guest");
        await expectStatus(users.anita, "post", "/api/effect", create, 403, "member with RO grant");
      });

      await setGrant(admin, shared.roadmapId, groupId, "RW");

      await test.step("RW grant: the member edits and creates; the guest still nothing", async () => {
        // Polled: the first read after the grant change was observed to serve the cached notice
        await expect.poll(() => noAccess(users.anita), { message: "member with RW grant", timeout: 20_000 }).toBe(false);
        await putJson(users.anita, "/api/effect", edit([6, 6, 6]));
        await expectStatus(users.anita, "post", "/api/effect", create, 201, "member with RW grant creating");
        await expectStatus(users.greta, "put", "/api/effect", edit([7, 7, 7]), 403, "guest with RW grant");
        expect(await noAccess(users.greta), "guest with RW grant").toBe(true);
        await putJson(admin, "/api/effect", edit([8, 8, 8]));
      });
    }
    finally {
      await deleteRoadmap(admin, shared.roadmapId);
    }
  });
});
