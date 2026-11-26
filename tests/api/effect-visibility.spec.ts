import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";
import { createAction, createEffect, createGoal, createIteration, createRoadmap, deleteAction, deleteRoadmap, pageEntity, pageStatus, yearlyDateValues } from "../lib/api";

/*
 * An effect joins one action to one goal, and the two can sit under different roadmaps (or
 * the action under none). Whoever may see only one side must not get the other through it:
 * no effect row, no series, and nothing of the hidden action or goal, in either direction.
 * The same rule as for the effect's own series (`visibleDataSeriesWHERE`) and `/effect/.../edit`.
 *
 * Each test builds a PUBLIC roadmap and an ORG-shared one in the fixtures org and reads the
 * pages as four users: anonymous and orgless (see only the public side), anita (member of the
 * org: sees both) and admin.
 */

test.slow(true, "streamed page reads against the shared dev server");

/** Values no other fixture produces, so the hidden effect's series can be searched for in a payload */
const HIDDEN_SERIES = [424242.5, 434343.5, 444444.5];

/**
 * The whole response of a page, as sent: every streamed chunk, escaped as on the wire.
 * Assert on it with `includes` (not `toContain`): a failure would print megabytes of page.
 */
async function pageBody(request: APIRequestContext, url: string): Promise<string> {
  const response = await request.get(url);
  expect(response.status(), `GET ${url}`).toBe(200);
  return await response.text();
}

type World = {
  publicRoadmapId: string;
  publicIterationId: string;
  orgRoadmapId: string;
  orgIterationId: string;
};

/** A PUBLIC and an ORG-shared roadmap in the fixtures org, each with one published version */
async function buildWorld(admin: APIRequestContext, orgId: string, label: string): Promise<World> {
  const publicRoadmapId = await createRoadmap(admin, orgId, { name: `Open ${label}`, access: { sharing: "PUBLIC", grants: [] } });
  const publicIterationId = await createIteration(admin, publicRoadmapId);
  const orgRoadmapId = await createRoadmap(admin, orgId, { name: `Internal ${label}`, access: { sharing: "ORG", grants: [] } });
  const orgIterationId = await createIteration(admin, orgRoadmapId);
  return { publicRoadmapId, publicIterationId, orgRoadmapId, orgIterationId };
}

async function removeWorld(admin: APIRequestContext, world: World): Promise<void> {
  await deleteRoadmap(admin, world.publicRoadmapId);
  await deleteRoadmap(admin, world.orgRoadmapId);
}

test.describe("goal → effect → action", () => {
  test("an action under an org-shared roadmap stays off a public goal's page for those who cannot open the action", async ({ admin, anita, orgless, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const goalId = await createGoal(admin, world.publicIterationId, { name: `Open goal ${sandbox.label}` });
      const visibleActionId = await createAction(admin, world.publicIterationId, { name: `Open action ${sandbox.label}`, startYear: 2021, endYear: 2023 });
      const hiddenActionName = `Internal action ${sandbox.label}`;
      const hiddenActionId = await createAction(admin, world.orgIterationId, { name: hiddenActionName, startYear: 2024, endYear: 2029 });
      await createEffect(admin, goalId, visibleActionId, { dateValues: yearlyDateValues([1, 2, 3]) });
      await createEffect(admin, goalId, hiddenActionId, { dateValues: yearlyDateValues(HIDDEN_SERIES) });

      // The premise: the goal is open to everyone, the action only to the org
      for (const [who, request, seesAction] of [["anonymous", anon, false], ["orgless", orgless, false], ["anita", anita, true], ["admin", admin, true]] as const) {
        expect(await pageStatus(request, `/goal/${goalId}`), `${who} opens the goal`).toBe(200);
        expect(await pageStatus(request, `/action/${hiddenActionId}`), `${who} opens the action`).toBe(seesAction ? 200 : 404);
      }

      for (const [who, request] of [["anonymous", anon], ["orgless", orgless]] as const) {
        const body = await pageBody(request, `/goal/${goalId}`);
        expect(body.includes(`Open goal ${sandbox.label}`), `${who}: the goal page rendered`).toBe(true);
        expect(body.includes(`Open action ${sandbox.label}`), `${who}: the visible action is listed`).toBe(true);
        expect(body.includes(hiddenActionName), `${who}: the hidden action's name`).toBe(false);
        expect(body.includes(hiddenActionId), `${who}: the hidden action's id`).toBe(false);
        expect(body.includes(String(HIDDEN_SERIES[0])), `${who}: the hidden effect's series`).toBe(false);

        const goal = await pageEntity(request, `/goal/${goalId}`, goalId);
        expect((goal?.effects as { action_id: string }[]).map(effect => effect.action_id), `${who}: the goal's effects`).toEqual([visibleActionId]);
      }

      // Those who may open the action still get the effect
      for (const [who, request] of [["anita", anita], ["admin", admin]] as const) {
        const goal = await pageEntity(request, `/goal/${goalId}`, goalId);
        expect((goal?.effects as { action_id: string }[]).map(effect => effect.action_id).sort(), `${who}: the goal's effects`).toEqual([visibleActionId, hiddenActionId].sort());
      }
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("an action in a draft version stays off a published goal's page for those who cannot see drafts", async ({ admin, anita, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const goalId = await createGoal(admin, world.publicIterationId, { name: `Open goal ${sandbox.label}` });
      const draftId = await createIteration(admin, world.publicRoadmapId, { status: "DRAFT" });
      const draftActionName = `Draft action ${sandbox.label}`;
      const draftActionId = await createAction(admin, draftId, { name: draftActionName });
      await createEffect(admin, goalId, draftActionId, { dateValues: yearlyDateValues(HIDDEN_SERIES) });

      // anita reads the public roadmap but has no edit access, so the draft is closed to her too
      for (const [who, request] of [["anonymous", anon], ["anita", anita]] as const) {
        expect(await pageStatus(request, `/action/${draftActionId}`), `${who} opens the draft action`).toBe(404);
        const body = await pageBody(request, `/goal/${goalId}`);
        expect(body.includes(`Open goal ${sandbox.label}`), `${who}: the goal page rendered`).toBe(true);
        expect(body.includes(draftActionName), `${who}: the draft action's name`).toBe(false);
        expect(body.includes(draftActionId), `${who}: the draft action's id`).toBe(false);
        expect(body.includes(String(HIDDEN_SERIES[0])), `${who}: the draft effect's series`).toBe(false);
      }
      const goal = await pageEntity(admin, `/goal/${goalId}`, goalId);
      expect((goal?.effects as { action_id: string }[]).map(effect => effect.action_id), "admin: the goal's effects").toEqual([draftActionId]);
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("the version page counts only the effects the viewer may see", async ({ admin, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const goalId = await createGoal(admin, world.publicIterationId, { name: `Open goal ${sandbox.label}` });
      const hiddenActionId = await createAction(admin, world.orgIterationId, { name: `Internal action ${sandbox.label}` });
      await createEffect(admin, goalId, hiddenActionId);
      // The other way round: a public action acting on a goal of the org-shared roadmap
      const publicActionId = await createAction(admin, world.publicIterationId, { name: `Open action ${sandbox.label}` });
      const hiddenGoalId = await createGoal(admin, world.orgIterationId, { name: `Internal goal ${sandbox.label}` });
      await createEffect(admin, hiddenGoalId, publicActionId);

      const versionUrl = `/roadmap/${world.publicRoadmapId}/v1`;
      const count = async (request: APIRequestContext, id: string) => ((await pageEntity(request, versionUrl, id))?._count as { effects: number } | undefined)?.effects;
      expect(await count(admin, goalId), "admin: effects on the goal").toBe(1);
      expect(await count(admin, publicActionId), "admin: effects of the action").toBe(1);
      expect(await count(anon, goalId), "anonymous: effects on the goal").toBe(0);
      expect(await count(anon, publicActionId), "anonymous: effects of the action").toBe(0);
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("a parent goal's hidden effects stay off the child goal's page", async ({ admin, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    const childRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Open child ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] }, parentRoadmapId: world.publicRoadmapId });
    try {
      const indicatorParameter = `Test\\${sandbox.label}`;
      const parentGoalId = await createGoal(admin, world.publicIterationId, { name: `Open goal ${sandbox.label}`, indicatorParameter });
      const childGoalId = await createGoal(admin, await createIteration(admin, childRoadmapId), { name: `Child goal ${sandbox.label}`, indicatorParameter });
      const hiddenActionName = `Internal action ${sandbox.label}`;
      const hiddenActionId = await createAction(admin, world.orgIterationId, { name: hiddenActionName });
      await createEffect(admin, parentGoalId, hiddenActionId, { dateValues: yearlyDateValues(HIDDEN_SERIES) });

      // The child's graph gets the parent goal with its effects (for the parent's predicted outcome)
      const adminBody = await pageBody(admin, `/goal/${childGoalId}`);
      expect(adminBody.includes(String(HIDDEN_SERIES[0])), "admin: the parent's effect reaches the child page").toBe(true);

      const body = await pageBody(anon, `/goal/${childGoalId}`);
      expect(body.includes(`Child goal ${sandbox.label}`), "the child goal page rendered").toBe(true);
      expect(body.includes(hiddenActionName), "the parent's hidden action name").toBe(false);
      expect(body.includes(String(HIDDEN_SERIES[0])), "the parent's hidden effect series").toBe(false);
    }
    finally {
      await deleteRoadmap(admin, childRoadmapId);
      await removeWorld(admin, world);
    }
  });
});

test.describe("action → effect → goal", () => {
  test("a goal under an org-shared roadmap stays off the page of an action from the shared database", async ({ admin, anita, orgless, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    // Roadmapless: world-readable whatever any roadmap's sharing says
    const actionId = await createAction(admin, undefined, { orgId: sandbox.orgId, name: `Database action ${sandbox.label}` });
    try {
      const visibleGoalId = await createGoal(admin, world.publicIterationId, { name: `Open goal ${sandbox.label}` });
      const hiddenGoalName = `Internal goal ${sandbox.label}`;
      const hiddenGoalId = await createGoal(admin, world.orgIterationId, { name: hiddenGoalName, description: `Internal description ${sandbox.label}` });
      await createEffect(admin, visibleGoalId, actionId, { dateValues: yearlyDateValues([1, 2, 3]) });
      await createEffect(admin, hiddenGoalId, actionId, { dateValues: yearlyDateValues(HIDDEN_SERIES) });

      for (const [who, request, seesGoal] of [["anonymous", anon, false], ["orgless", orgless, false], ["anita", anita, true], ["admin", admin, true]] as const) {
        expect(await pageStatus(request, `/action/${actionId}`), `${who} opens the action`).toBe(200);
        expect(await pageStatus(request, `/goal/${hiddenGoalId}`), `${who} opens the goal`).toBe(seesGoal ? 200 : 404);
      }

      for (const [who, request] of [["anonymous", anon], ["orgless", orgless]] as const) {
        const body = await pageBody(request, `/action/${actionId}`);
        expect(body.includes(`Database action ${sandbox.label}`), `${who}: the action page rendered`).toBe(true);
        expect(body.includes(`Open goal ${sandbox.label}`), `${who}: the visible goal is listed`).toBe(true);
        expect(body.includes(hiddenGoalName), `${who}: the hidden goal's name`).toBe(false);
        expect(body.includes(`Internal description ${sandbox.label}`), `${who}: the hidden goal's description`).toBe(false);
        expect(body.includes(hiddenGoalId), `${who}: the hidden goal's id`).toBe(false);
        expect(body.includes(String(HIDDEN_SERIES[0])), `${who}: the hidden effect's series`).toBe(false);

        const action = await pageEntity(request, `/action/${actionId}`, actionId);
        expect((action?.effects as { goal_id: string }[]).map(effect => effect.goal_id), `${who}: the action's effects`).toEqual([visibleGoalId]);
      }

      for (const [who, request] of [["anita", anita], ["admin", admin]] as const) {
        const action = await pageEntity(request, `/action/${actionId}`, actionId);
        expect((action?.effects as { goal_id: string }[]).map(effect => effect.goal_id).sort(), `${who}: the action's effects`).toEqual([visibleGoalId, hiddenGoalId].sort());
      }
    }
    finally {
      await deleteAction(admin, actionId);
      await removeWorld(admin, world);
    }
  });
});
