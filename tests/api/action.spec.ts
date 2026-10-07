import { expect, test } from "../lib/users";
import type { APIRequestContext } from "playwright/test";
import type { ActionField, PageEntity } from "../lib/api";
import {
  createAction, createGoal, createIteration, createRoadmap, deleteAction, deleteRoadmap, expectPageStatus, flightPayload, groupIdByName, pageEntity, pageEntityWhen, pageStatus, postJson, putJson, Seed, yearlyDateValues,
} from "../lib/api";

/*
 * Contract of /api/action: descriptive fields keep their order, roadmapless
 * actions need an org and its managers, origin links resolve one level deep and
 * show on both sides, invisible origins are refused, and the usual stale
 * timestamp / access rules.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const NIL = "00000000-0000-0000-0000-000000000000";

/** PUT /api/action body with a fresh timestamp */
function update(actionId: string, name: string, fields: Record<string, unknown> = {}) {
  return { actionId, name, timestamp: Date.now(), ...fields };
}

/** The field values of an action as its page delivers them, in display order */
function fieldValues(action: PageEntity | null): string[] {
  return (action?.fields as { value: string, order: number }[] ?? []).map(field => field.value);
}

/** Waits for the action page to deliver `expected` as its field values (a write's first page read may be stale) */
async function expectFieldValues(request: APIRequestContext, actionId: string, expected: string[]): Promise<void> {
  await expect.poll(async () => fieldValues(await pageEntity(request, `/action/${actionId}`, actionId)), { timeout: 60_000 }).toEqual(expected);
}

test.describe("Fields", () => {
  test("fields are persisted and returned in the order they were sent, through create and update", async ({ admin, sandbox }) => {
    const fields: ActionField[] = [
      { header: "COST_EFFICIENCY", value: `third ${sandbox.label}`, type: "SHORT" },
      { header: "DESCRIPTION", value: `first ${sandbox.label}`, type: "PARAGRAPH" },
      { header: "DEADLINE", value: "2030-12-31", type: "DATE" },
      { header: "RELEVANT_ACTORS", value: `actor b ${sandbox.label}`, type: "SHORT" },
      { header: "RELEVANT_ACTORS", value: `actor a ${sandbox.label}`, type: "SHORT" },
    ];
    const response = await admin.post("/api/action", {
      data: { iterationId: sandbox.iterationId, name: `Fielded ${sandbox.label}`, startYear: 2025, endYear: 2030, fields, parentActionId: null },
    });
    const text = await response.text();
    expect(response.status(), text).toBe(201);
    const actionId = (JSON.parse(text) as { id: string }).id;
    expect(response.headers()["location"]).toBe(`/action/${actionId}`);

    const action = await pageEntity(admin, `/action/${actionId}`, actionId);
    expect(action?.start_year).toBe(2025);
    expect(action?.end_year).toBe(2030);
    expect(action?.indicator_parameter, "the indicator parameter falls back to the name").toBe(`Fielded ${sandbox.label}`);
    const stored = action?.fields as { header: string, value: string, type: string, order: number }[];
    expect(stored.map(field => [field.header, field.value, field.type])).toEqual(fields.map(field => [field.header, field.value, field.type]));
    expect(stored.map(field => field.order)).toEqual([0, 1, 2, 3, 4]);

    // A full replacement in another order
    const reversed = [...fields].reverse();
    await putJson(admin, "/api/action", update(actionId, `Fielded ${sandbox.label}`, { fields: reversed }));
    await expectFieldValues(admin, actionId, reversed.map(field => field.value));

    // Omitted fields are left alone; null clears them
    await putJson(admin, "/api/action", update(actionId, `Fielded again ${sandbox.label}`));
    const renamed = await pageEntityWhen(admin, `/action/${actionId}`, actionId, action => action?.name === `Fielded again ${sandbox.label}`);
    expect(fieldValues(renamed)).toEqual(reversed.map(field => field.value));
    await putJson(admin, "/api/action", update(actionId, `Fielded again ${sandbox.label}`, { fields: null }));
    await expectFieldValues(admin, actionId, []);
  });

  test("an unknown field type falls back to PARAGRAPH", async ({ admin, sandbox }) => {
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Typed ${sandbox.label}`, fields: [{ header: "X", value: "y", type: "BOGUS" as "SHORT" }] });
    const action = await pageEntity(admin, `/action/${actionId}`, actionId);
    expect((action?.fields as { type: string }[])[0].type).toBe("PARAGRAPH");
  });
});

test.describe("Create", () => {
  test("a roadmapless action needs an orgId and a manager of that org", async ({ admin, anita, sandbox }) => {
    const noParent = await admin.post("/api/action", { data: { name: `Orphan ${sandbox.label}`, fields: [] } });
    const noParentText = await noParent.text();
    expect(noParent.status(), noParentText).toBe(400);
    expect((JSON.parse(noParentText) as { message: string }).message).toEqual(expect.any(String));

    const member = await anita.post("/api/action", { data: { orgId: sandbox.orgId, name: `Orphan ${sandbox.label}`, fields: [] } });
    expect(member.status(), await member.text()).toBe(403);

    const actionId = await createAction(admin, undefined, { orgId: sandbox.orgId, name: `Database ${sandbox.label}` });
    try {
      const action = await pageEntity(admin, `/action/${actionId}`, actionId);
      expect(action?.roadmap_iteration).toBeNull();
      expect(action?.org_id).toBe(sandbox.orgId);
      expect(await pageStatus(anita, `/action/${actionId}`), "the public action database is readable by members").toBe(200);
      // Editing it stays with the org's managers
      const edit = await anita.put("/api/action", { data: update(actionId, "nope") });
      expect(edit.status(), await edit.text()).toBe(403);
      await deleteAction(anita, actionId, 403);
    }
    finally {
      await deleteAction(admin, actionId);
    }
  });

  test("a missing name is 400; anonymous 401; orgless and view-only members are IllegalParent", async ({ admin, anita, orgless, anon, sandbox }) => {
    const noName = await admin.post("/api/action", { data: { iterationId: sandbox.iterationId, fields: [] } });
    expect(noName.status(), await noName.text()).toBe(400);
    const body = { iterationId: sandbox.iterationId, name: `Nope ${sandbox.label}`, fields: [] };
    const anonymous = await anon.post("/api/action", { data: body });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    const nobody = await orgless.post("/api/action", { data: body });
    expect(nobody.status(), await nobody.text()).toBe(403);
    const member = await anita.post("/api/action", { data: body });
    expect(member.status(), await member.text()).toBe(403);
    const unknownIteration = await admin.post("/api/action", { data: { ...body, iterationId: NIL } });
    expect(unknownIteration.status(), await unknownIteration.text()).toBe(403);
  });

  test("goalId with a data series creates the effect in the same call", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const { id } = await postJson(admin, "/api/action", {
      iterationId: sandbox.iterationId, goalId, name: `Effective ${sandbox.label}`, fields: [],
      dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 1]) }, impactType: "DELTA",
    });
    const action = await pageEntity(admin, `/action/${id ?? ""}`, id ?? "");
    const effects = action?.effects as { goal_id: string, impact_type: string }[];
    expect(effects.map(effect => [effect.goal_id, effect.impact_type])).toEqual([[goalId, "DELTA"]]);

    const badSeries = await admin.post("/api/action", {
      data: { iterationId: sandbox.iterationId, goalId, name: `Broken ${sandbox.label}`, fields: [], dataSeries: { unit: "ton", dateValues: { "2020": 1 } } },
    });
    expect(badSeries.status(), await badSeries.text()).toBe(400);
    const unknownGoal = await admin.post("/api/action", { data: { iterationId: sandbox.iterationId, goalId: NIL, name: `Lost ${sandbox.label}`, fields: [] } });
    expect(unknownGoal.status(), await unknownGoal.text()).toBe(403);
  });
});

test.describe("Origin", () => {
  test("linking an origin shows on both pages, unlinking clears both", async ({ admin, sandbox }) => {
    const originId = await createAction(admin, sandbox.iterationId, { name: `Origin ${sandbox.label}` });
    const copyId = await createAction(admin, sandbox.iterationId, { name: `Copy ${sandbox.label}`, originActionId: originId });

    expect((await pageEntity(admin, `/action/${copyId}`, copyId))?.origin_action_id).toBe(originId);
    const copyPage = await flightPayload(admin, `/action/${copyId}`);
    expect(copyPage).toContain('"data-testid":"action-neighbours"');
    expect(copyPage).toContain(`"href":"/action/${originId}"`);
    const originPage = await flightPayload(admin, `/action/${originId}`);
    expect(originPage).toContain('"data-testid":"action-neighbours"');
    expect(originPage).toContain(`"href":"/action/${copyId}"`);

    // `undefined` leaves the link alone, `null` unlinks
    await putJson(admin, "/api/action", update(copyId, `Copy renamed ${sandbox.label}`));
    const renamed = await pageEntityWhen(admin, `/action/${copyId}`, copyId, action => action?.name === `Copy renamed ${sandbox.label}`);
    expect(renamed?.origin_action_id).toBe(originId);
    await putJson(admin, "/api/action", update(copyId, `Copy renamed ${sandbox.label}`, { originActionId: null }));
    await pageEntityWhen(admin, `/action/${copyId}`, copyId, action => action?.origin_action_id === null);
    await expect.poll(() => flightPayload(admin, `/action/${copyId}`), { timeout: 60_000 }).not.toContain('"data-testid":"action-neighbours"');
    await expect.poll(() => flightPayload(admin, `/action/${originId}`), { timeout: 60_000 }).not.toContain('"data-testid":"action-neighbours"');
  });

  test("links stay one level deep and never point at oneself", async ({ admin, sandbox }) => {
    const originId = await createAction(admin, sandbox.iterationId, { name: `Root ${sandbox.label}` });
    const copyId = await createAction(admin, sandbox.iterationId, { name: `Copy ${sandbox.label}`, originActionId: originId });
    // Linking to a copy resolves to its origin
    const secondId = await createAction(admin, sandbox.iterationId, { name: `Second ${sandbox.label}`, originActionId: copyId });
    expect((await pageEntity(admin, `/action/${secondId}`, secondId))?.origin_action_id).toBe(originId);

    const self = await admin.put("/api/action", { data: update(secondId, `Second ${sandbox.label}`, { originActionId: secondId }) });
    expect(self.status(), await self.text()).toBe(400);
    // An origin with copies cannot itself become a copy
    const cycle = await admin.put("/api/action", { data: update(originId, `Root ${sandbox.label}`, { originActionId: secondId }) });
    expect(cycle.status(), await cycle.text()).toBe(400);
    const unknown = await admin.put("/api/action", { data: update(secondId, `Second ${sandbox.label}`, { originActionId: NIL }) });
    expect(unknown.status(), await unknown.text()).toBe(400);
  });

  test("the origin must be visible to the user: a hidden action is refused with 400", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const hiddenRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Hidden ${sandbox.label}`, access: { sharing: "GROUPS", grants: [] } });
    const editableRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Editable ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const hiddenActionId = await createAction(admin, await createIteration(admin, hiddenRoadmapId), { name: `Hidden action ${sandbox.label}` });
      expect(await pageStatus(anita, `/action/${hiddenActionId}`)).toBe(404);
      const editableIterationId = await createIteration(admin, editableRoadmapId);

      const refused = await anita.post("/api/action", { data: { iterationId: editableIterationId, name: `Copy ${sandbox.label}`, fields: [], originActionId: hiddenActionId } });
      const text = await refused.text();
      expect(refused.status(), text).toBe(400);
      expect((JSON.parse(text) as { message: string }).message).toEqual(expect.any(String));

      // The manager sees it, so for her it is a legal origin; anita then sees the copy but not its hidden origin
      const copyId = await createAction(admin, editableIterationId, { name: `Copy ${sandbox.label}`, originActionId: hiddenActionId });
      expect((await pageEntity(anita, `/action/${copyId}`, copyId))?.origin_action_id).toBe(hiddenActionId);
      expect(await flightPayload(anita, `/action/${copyId}`), "hidden neighbours are not listed").not.toContain(`"href":"/action/${hiddenActionId}"`);
    }
    finally {
      await deleteRoadmap(admin, editableRoadmapId);
      await deleteRoadmap(admin, hiddenRoadmapId);
    }
  });
});

test.describe("Update and delete", () => {
  test("a stale or missing timestamp answers 409; a missing name 400", async ({ admin, sandbox }) => {
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Stale ${sandbox.label}` });
    const stale = await admin.put("/api/action", { data: { actionId, name: "stale", timestamp: Date.now() - 24 * 60 * 60 * 1000 } });
    const text = await stale.text();
    expect(stale.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/stale/i);
    const missing = await admin.put("/api/action", { data: { actionId, name: "no timestamp" } });
    expect(missing.status(), await missing.text()).toBe(409);
    const noName = await admin.put("/api/action", { data: { actionId, timestamp: Date.now() } });
    expect(noName.status(), await noName.text()).toBe(400);
    expect((await pageEntity(admin, `/action/${actionId}`, actionId))?.name).toBe(`Stale ${sandbox.label}`);
  });

  test("a view-only member cannot update or delete; anonymous gets 401; the editor's delete answers with the iteration", async ({ admin, anita, anon, sandbox }) => {
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Guarded ${sandbox.label}` });
    const member = await anita.put("/api/action", { data: update(actionId, "nope") });
    expect(member.status(), await member.text()).toBe(403);
    await deleteAction(anita, actionId, 403);
    const anonymous = await anon.delete("/api/action", { data: { id: actionId } });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    const unknown = await admin.put("/api/action", { data: update(NIL, "nope") });
    expect(unknown.status(), await unknown.text()).toBe(403);

    const response = await admin.delete("/api/action", { data: { id: actionId } });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["location"]).toBe(`/roadmap/${sandbox.roadmapId}/v1`);
    await expectPageStatus(admin, `/action/${actionId}`, 404);
    await deleteAction(admin, actionId, 403);
  });
});
