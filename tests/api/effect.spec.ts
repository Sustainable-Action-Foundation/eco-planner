import { expect, test } from "../lib/users";
import {
  createAction, createEffect, createGoal, createIteration, createRoadmap, deleteEffect, deleteRoadmap, flightObjectAt, flightPayload, groupIdByName, pageEntity, pageEntityWhen, putJson, Seed, seriesValues, yearlyDateValues,
} from "../lib/api";

/*
 * Contract of /api/effect (an action's effect on a goal, keyed by the pair):
 * create, edit, delete, the duplicate 409, effects across roadmaps (own vs
 * foreign rows on the goal page), stale timestamps and access to both sides.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const NIL = "00000000-0000-0000-0000-000000000000";

/** The action ids listed in one of the goal page's effect sections (`goal-action-row` / `goal-foreign-effect-row`) */
async function listedActions(request: Parameters<typeof flightPayload>[0], goalId: string, testId: string): Promise<string[]> {
  const text = await flightPayload(request, `/goal/${goalId}`);
  const marker = text.indexOf(`"testId":"${testId}"`);
  expect(marker, `${testId} on the goal page`).toBeGreaterThan(-1);
  const props = JSON.parse(flightObjectAt(text, text.lastIndexOf('{"effects":', marker)) ?? "{}") as { effects: ({ action_id: string } | string)[] };
  // RSC dedupes effects already sent with the goal into path references (`"$276:...:goal:effects:0"`)
  const goal = await pageEntity(request, `/goal/${goalId}`, goalId);
  const goalEffects = goal?.effects as { action_id: string }[] ?? [];
  return props.effects.map(effect => {
    if (typeof effect !== "string") return effect.action_id;
    const index = effect.match(/:effects:(\d+)$/)?.[1];
    expect(index, `resolvable effect reference ${effect}`).toBeTruthy();
    return goalEffects[Number(index)]?.action_id;
  });
}

/** The goal page's effect on the action, as delivered to the graph */
async function goalEffect(request: Parameters<typeof pageEntity>[0], goalId: string, actionId: string) {
  const goal = await pageEntity(request, `/goal/${goalId}`, goalId);
  return (goal?.effects as { action_id: string, impact_type: string, data_series: unknown }[] ?? []).find(effect => effect.action_id === actionId) ?? null;
}

test.describe("Lifecycle", () => {
  test("POST creates the effect, PUT edits it, DELETE removes it from both pages", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });

    const created = await admin.post("/api/effect", { data: { goalId, actionId, impactType: "ABSOLUTE", dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3]) } } });
    const createdText = await created.text();
    expect(created.status(), createdText).toBe(201);
    expect(JSON.parse(createdText)).toMatchObject({ actionId, goalId });

    const effect = await goalEffect(admin, goalId, actionId);
    expect(effect?.impact_type).toBe("ABSOLUTE");
    expect(seriesValues(effect?.data_series)).toEqual([1, 2, 3]);
    expect(await listedActions(admin, goalId, "goal-action-row"), "the goal's own action").toEqual([actionId]);
    expect(await listedActions(admin, goalId, "goal-foreign-effect-row")).toEqual([]);
    const action = await pageEntityWhen(admin, `/action/${actionId}`, actionId, entity => Array.isArray(entity?.effects), "the action page with its effects");
    expect((action?.effects as { goal_id: string }[]).map(e => e.goal_id)).toEqual([goalId]);

    const updated = await admin.put("/api/effect", { data: { goalId, actionId, impactType: "PERCENT", dataSeries: { unit: "kg", dateValues: yearlyDateValues([5, 5]) }, timestamp: Date.now() } });
    expect(updated.status(), await updated.text()).toBe(200);
    await expect.poll(async () => (await goalEffect(admin, goalId, actionId))?.impact_type, { timeout: 60_000 }).toBe("PERCENT");
    const edited = await goalEffect(admin, goalId, actionId);
    expect(seriesValues(edited?.data_series)).toEqual([5, 5]);
    expect((edited?.data_series as { unit: string }).unit).toBe("kg");

    // Deletes revalidate with `max` (stale-while-revalidate): the pages catch up on a later read
    const deleted = await admin.delete("/api/effect", { data: { goalId, actionId } });
    expect(deleted.status(), await deleted.text()).toBe(200);
    await expect.poll(() => goalEffect(admin, goalId, actionId), { message: "the goal no longer carries the effect", timeout: 60_000 }).toBeNull();
    await expect.poll(async () => ((await pageEntity(admin, `/action/${actionId}`, actionId))?.effects as unknown[]).length, { message: "the action no longer lists it", timeout: 60_000 }).toBe(0);
    await deleteEffect(admin, goalId, actionId, 403);
  });

  test("the same action cannot affect the same goal twice (409)", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
    await createEffect(admin, goalId, actionId);
    const duplicate = await admin.post("/api/effect", { data: { goalId, actionId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([9]) } } });
    const text = await duplicate.text();
    expect(duplicate.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toEqual(expect.any(String));
    expect(seriesValues((await goalEffect(admin, goalId, actionId))?.data_series), "the first effect is untouched").toEqual([1, 1, 1]);
  });

  test("an action from another roadmap lands among the goal's foreign effects when the user edits both", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const otherRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Other ${sandbox.label}` });
    try {
      const otherActionId = await createAction(admin, await createIteration(admin, otherRoadmapId), { name: `Elsewhere ${sandbox.label}` });
      const databaseActionId = await createAction(admin, undefined, { orgId: sandbox.orgId, name: `Database ${sandbox.label}` });
      try {
        await createEffect(admin, goalId, otherActionId);
        await createEffect(admin, goalId, databaseActionId);
        expect(await listedActions(admin, goalId, "goal-action-row")).toEqual([]);
        expect((await listedActions(admin, goalId, "goal-foreign-effect-row")).sort()).toEqual([otherActionId, databaseActionId].sort());
      }
      finally {
        await admin.delete("/api/action", { data: { id: databaseActionId } });
      }
    }
    finally {
      await deleteRoadmap(admin, otherRoadmapId);
    }
  });
});

test.describe("Validation and access", () => {
  test("invalid bodies answer 400, a missing timestamp on PUT 409, a stale one 409", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
    await createEffect(admin, goalId, actionId);

    for (const [name, body] of Object.entries({
      "no series": { goalId, actionId },
      "bad impact type": { goalId, actionId, impactType: "HUGE", dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } },
      "bad date key": { goalId, actionId, dataSeries: { unit: "ton", dateValues: { "2020": 1 } } },
      "no unit": { goalId, actionId, dataSeries: { dateValues: yearlyDateValues([1]) } },
    })) {
      const response = await admin.post("/api/effect", { data: body });
      expect(response.status(), `${name}: ${await response.text()}`).toBe(400);
    }
    const badDelete = await admin.delete("/api/effect", { data: { goalId } });
    expect(badDelete.status(), await badDelete.text()).toBe(400);

    const series = { unit: "ton", dateValues: yearlyDateValues([2]) };
    const missing = await admin.put("/api/effect", { data: { goalId, actionId, dataSeries: series } });
    expect(missing.status(), await missing.text()).toBe(409);
    const stale = await admin.put("/api/effect", { data: { goalId, actionId, dataSeries: series, timestamp: Date.now() - 24 * 60 * 60 * 1000 } });
    const text = await stale.text();
    expect(stale.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/stale/i);
    expect(seriesValues((await goalEffect(admin, goalId, actionId))?.data_series)).toEqual([1, 1, 1]);
  });

  test("anonymous 401; a view-only member may neither create (IllegalParent) nor edit nor delete; unknown parents are IllegalParent", async ({ admin, anita, anon, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Goal ${sandbox.label}` });
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
    const body = { goalId, actionId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } };

    const anonymous = await anon.post("/api/effect", { data: body });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    const member = await anita.post("/api/effect", { data: body });
    const memberText = await member.text();
    expect(member.status(), memberText).toBe(403);
    expect((JSON.parse(memberText) as { message: string }).message).toMatch(/parent/i);
    const unknownGoal = await admin.post("/api/effect", { data: { ...body, goalId: NIL } });
    expect(unknownGoal.status(), await unknownGoal.text()).toBe(403);
    const unknownAction = await admin.post("/api/effect", { data: { ...body, actionId: NIL } });
    expect(unknownAction.status(), await unknownAction.text()).toBe(403);

    await createEffect(admin, goalId, actionId);
    const edit = await anita.put("/api/effect", { data: { ...body, timestamp: Date.now() } });
    expect(edit.status(), await edit.text()).toBe(403);
    await deleteEffect(anita, goalId, actionId, 403);
    await deleteEffect(admin, goalId, NIL, 403);
  });

  test("editing both sides is required: a member who may edit the goal but not the action is refused", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    // anita edits this roadmap...
    const editableRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Editable ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const goalId = await createGoal(admin, await createIteration(admin, editableRoadmapId), { name: `Own goal ${sandbox.label}` });
      // ...but only reads the sandbox, where the action lives
      const actionId = await createAction(admin, sandbox.iterationId, { name: `Read-only action ${sandbox.label}` });
      const refused = await anita.post("/api/effect", { data: { goalId, actionId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } } });
      expect(refused.status(), await refused.text()).toBe(403);

      // An action she can edit works, wherever the goal lives (as long as she edits it too)
      const ownActionId = await createAction(anita, await createIteration(anita, editableRoadmapId, { status: "DRAFT" }), { name: `Own action ${sandbox.label}` });
      const allowed = await anita.post("/api/effect", { data: { goalId, actionId: ownActionId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } } });
      expect(allowed.status(), await allowed.text()).toBe(201);
      await putJson(anita, "/api/effect", { goalId, actionId: ownActionId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([2]) }, timestamp: Date.now() });
      await deleteEffect(anita, goalId, ownActionId);
    }
    finally {
      await deleteRoadmap(admin, editableRoadmapId);
    }
  });
});
