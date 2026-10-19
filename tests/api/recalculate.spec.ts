import { expect, test } from "../lib/users";
import { createGoal, linkedScalarRecipe, pageEntity, pageEntityWhen, postJson, putJson, seriesValues, yearlyDateValues } from "../lib/api";

/*
 * Contract of /api/recalculate: re-evaluates a data series from its recipe.
 * A child goal whose series is `<parent series> * <scalar>` picks up a change
 * to the parent's series only once recalculated; the route needs a signed-in
 * user with edit access to the series.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const NIL = "00000000-0000-0000-0000-000000000000";

/** A parent goal with a manual series and a child goal computed from it through a linked recipe; resolves with both ids and the child's series id. */
async function linkedPair(admin: Parameters<typeof createGoal>[0], iterationId: string, label: string, scalar: number) {
  const parentId = await createGoal(admin, iterationId, { name: `Parent ${label}`, dateValues: yearlyDateValues([10, 20, 30]) });
  const parentSeriesId = (await pageEntity(admin, `/goal/${parentId}`, parentId))?.data_series_id as string;
  expect(parentSeriesId).toEqual(expect.any(String));

  // The goal form evaluates the recipe client-side and sends the result along with it
  const { id: childId } = await postJson(admin, "/api/goal", {
    target: "FULL", iterationId, name: `Child ${label}`, description: null, indicatorParameter: `Child\\${label}`, rawTags: null,
    dataSeriesRecipe: linkedScalarRecipe({ dataSeriesId: parentSeriesId, unit: "ton", scalar }),
    dataSeries: { unit: "ton", dateValues: yearlyDateValues([10 * scalar, 20 * scalar, 30 * scalar]) },
  });
  const child = await pageEntity(admin, `/goal/${childId ?? ""}`, childId ?? "");
  const childSeriesId = child?.data_series_id as string;
  expect(seriesValues(child?.data_series)).toEqual([10 * scalar, 20 * scalar, 30 * scalar]);
  return { parentId, parentSeriesId, childId: childId ?? "", childSeriesId };
}

test("a child series follows its parent once recalculated", async ({ admin, sandbox }) => {
  const { parentId, childId, childSeriesId } = await linkedPair(admin, sandbox.iterationId, sandbox.label, 2);

  await putJson(admin, "/api/goal", { target: "DATA_SERIES", goalId: parentId, timestamp: Date.now(), dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3, 4]) } });
  await pageEntityWhen(admin, `/goal/${parentId}`, parentId, parent => seriesValues(parent?.data_series).length === 4, "the parent's new series");
  // Twice: the first read after a write may still be the pre-write cache entry
  for (let read = 0; read < 2; read++) {
    expect(seriesValues((await pageEntity(admin, `/goal/${childId}`, childId))?.data_series), "nothing moves until recalculated").toEqual([20, 40, 60]);
  }

  const response = await admin.post("/api/recalculate", { data: { dataSeriesId: childSeriesId } });
  const text = await response.text();
  expect(response.status(), text).toBe(200);
  expect(JSON.parse(text)).toMatchObject({ id: childSeriesId });

  // Recalculation revalidates with `max` (stale-while-revalidate), so the page catches up on a later read
  const child = await pageEntityWhen(admin, `/goal/${childId}`, childId, goal => seriesValues(goal?.data_series).length === 4, "the recalculated child series");
  expect(seriesValues(child?.data_series)).toEqual([2, 4, 6, 8]);
  expect((child?.data_series as { unit: string }).unit).toBe("ton");
});

test("recalculating a manual series keeps its values", async ({ admin, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Manual ${sandbox.label}`, dateValues: yearlyDateValues([7, 8]) });
  const seriesId = (await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series_id as string;
  const response = await admin.post("/api/recalculate", { data: { dataSeriesId: seriesId } });
  expect(response.status(), await response.text()).toBe(200);
  for (let read = 0; read < 2; read++) {
    expect(seriesValues((await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series)).toEqual([7, 8]);
  }
});

test("needs a signed-in user with edit access: anonymous 401, missing id 400, unknown id 403, view-only member 403", async ({ admin, anita, anon, sandbox }) => {
  const { childSeriesId } = await linkedPair(admin, sandbox.iterationId, sandbox.label, 3);

  const anonymous = await anon.post("/api/recalculate", { data: { dataSeriesId: childSeriesId } });
  expect(anonymous.status(), await anonymous.text()).toBe(401);
  const missing = await admin.post("/api/recalculate", { data: {} });
  expect(missing.status(), await missing.text()).toBe(400);
  const noBody = await admin.post("/api/recalculate", { headers: { "content-type": "application/json" }, data: "not json" });
  expect(noBody.status(), await noBody.text()).toBe(400);
  // A series that doesn't exist is indistinguishable from one the user may not edit
  const unknown = await admin.post("/api/recalculate", { data: { dataSeriesId: NIL } });
  expect(unknown.status(), await unknown.text()).toBe(403);
  const member = await anita.post("/api/recalculate", { data: { dataSeriesId: childSeriesId } });
  expect(member.status(), await member.text()).toBe(403);
});
