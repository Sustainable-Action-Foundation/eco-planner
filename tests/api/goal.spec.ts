import { expect, test } from "../lib/users";
import {
  createAction, createEffect, createGoal, createIteration, createRoadmap, deleteGoal, deleteRoadmap, expectPageStatus, groupIdByName,
  flightPayload, linkedScalarRecipe, pageEntity, pageEntityWhen, pageStatus, postJson, putJson, scalarRecipe, Seed, seriesValues, yearlyDateValues,
} from "../lib/api";

/*
 * Contract of /api/goal: the `target`-tagged bodies (FULL create, then the
 * sectional DATA_SERIES / BASELINE / HISTORICAL / RECIPE_SUGGESTIONS writes as
 * POST = add and PUT = replace), validation, the duplicate-copy 409, the stale
 * timestamp 409, blank names, the delete cascade and IllegalSource. Everything
 * is read back from the page RSC payload (there are no GET handlers).
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");


/** A full goal body with a manual series, as the goal form sends it */
function fullGoalBody(iterationId: string, label: string, extra: Record<string, unknown> = {}) {
  return {
    target: "FULL",
    iterationId,
    name: `Goal ${label}`,
    description: null,
    indicatorParameter: `Api\\${label}`,
    rawTags: null,
    dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3]) },
    ...extra,
  };
}

test.describe("Full create", () => {
  test("POST FULL answers 201 with the id and a Location, and the page carries the series", async ({ admin, sandbox }) => {
    const response = await admin.post("/api/goal", { data: fullGoalBody(sandbox.iterationId, sandbox.label) });
    const text = await response.text();
    expect(response.status(), text).toBe(201);
    const body = JSON.parse(text) as { id: string, message: string };
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers()["location"]).toBe(`/goal/${body.id}`);

    const goal = await pageEntity(admin, `/goal/${body.id}`, body.id);
    expect(goal, "goal on its page").toBeTruthy();
    expect(goal?.name).toBe(`Goal ${sandbox.label}`);
    expect(goal?.indicator_parameter).toBe(`Api\\${sandbox.label}`);
    expect(goal?.listing).toBe("LISTED");
    expect((goal?.data_series as { unit: string }).unit).toBe("ton");
    expect(seriesValues(goal?.data_series)).toEqual([1, 2, 3]);
    expect(goal?.baseline_id).toBeNull();
    expect(goal?.historical_id).toBeNull();
  });

  test("POST FULL with a baseline, suggestions and listing stores every section", async ({ admin, sandbox }) => {
    const id = (await postJson(admin, "/api/goal", fullGoalBody(sandbox.iterationId, sandbox.label, {
      listing: "FEATURED",
      baseline: { unit: "ton", dateValues: yearlyDateValues([5, 5, 5]) },
      recipeSuggestions: [scalarRecipe(`Suggestion ${sandbox.label}`, 3)],
    }))).id ?? "";

    const goal = await pageEntity(admin, `/goal/${id}`, id);
    expect(goal?.listing).toBe("FEATURED");
    expect(seriesValues(goal?.baseline)).toEqual([5, 5, 5]);
    const suggestions = goal?.recipe_suggestions as { recipe: string }[];
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].recipe).toContain(`Suggestion ${sandbox.label}`);
  });

  test("invalid bodies answer 400 with a message", async ({ admin, sandbox }) => {
    const cases: { name: string, body: unknown }[] = [
      { name: "missing dataSeries", body: { target: "FULL", iterationId: sandbox.iterationId, indicatorParameter: "x" } },
      { name: "unknown target", body: { target: "NOPE", iterationId: sandbox.iterationId } },
      { name: "bad date key", body: fullGoalBody(sandbox.iterationId, sandbox.label, { dataSeries: { unit: "ton", dateValues: { "2020": 1 } } }) },
      { name: "missing unit", body: fullGoalBody(sandbox.iterationId, sandbox.label, { dataSeries: { dateValues: yearlyDateValues([1]) } }) },
      { name: "timestamp on create", body: fullGoalBody(sandbox.iterationId, sandbox.label, { timestamp: Date.now() }) },
      { name: "array body", body: [fullGoalBody(sandbox.iterationId, sandbox.label)] },
    ];
    for (const { name, body } of cases) {
      const response = await admin.post("/api/goal", { data: body });
      const text = await response.text();
      expect(response.status(), `${name}: ${text}`).toBe(400);
      expect((JSON.parse(text) as { message: string }).message, name).toEqual(expect.any(String));
    }

    const put = await admin.put("/api/goal", { data: { target: "FULL", goalId: "00000000-0000-0000-0000-000000000000", name: "x" } });
    expect(put.status(), `PUT without timestamp: ${await put.text()}`).toBe(400);
  });

  test("anonymous and orgless users are refused (401 / 403 IllegalParent)", async ({ anon, orgless, sandbox }) => {
    const anonymous = await anon.post("/api/goal", { data: fullGoalBody(sandbox.iterationId, sandbox.label) });
    expect(anonymous.status(), await anonymous.text()).toBe(401);

    const forbidden = await orgless.post("/api/goal", { data: fullGoalBody(sandbox.iterationId, sandbox.label) });
    const text = await forbidden.text();
    expect(forbidden.status(), text).toBe(403);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/parent/i);
  });

  test("a goal in an unknown iteration is IllegalParent", async ({ admin, sandbox }) => {
    const response = await admin.post("/api/goal", { data: fullGoalBody("00000000-0000-0000-0000-000000000000", sandbox.label) });
    expect(response.status(), await response.text()).toBe(403);
  });
});

test.describe("Sectional writes", () => {
  test("DATA_SERIES: POST overwrites the goal's series in place, PUT replaces it again", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Series ${sandbox.label}` });
    const before = await pageEntity(admin, `/goal/${goalId}`, goalId);
    const seriesId = before?.data_series_id;
    expect(seriesId).toEqual(expect.any(String));

    await postJson(admin, "/api/goal", {
      target: "DATA_SERIES", goalId, timestamp: Date.now(),
      dataSeries: { unit: "kg", dateValues: yearlyDateValues([10, 20]) },
    }, 200);
    const added = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => (goal?.data_series as { unit: string } | undefined)?.unit === "kg");
    expect(added?.data_series_id, "same series row, updated in place").toBe(seriesId);
    expect(seriesValues(added?.data_series)).toEqual([10, 20]);

    await putJson(admin, "/api/goal", {
      target: "DATA_SERIES", goalId, timestamp: Date.now(),
      dataSeries: { unit: "kg", dateValues: yearlyDateValues([7, 8, 9], 2030) },
    }, 200);
    const replaced = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => seriesValues(goal?.data_series)[0] === 7);
    expect(replaced?.data_series_id).toBe(seriesId);
    expect(seriesValues(replaced?.data_series)).toEqual([7, 8, 9]);
  });

  test("BASELINE: POST adds a baseline series, PUT replaces it with a fresh one, a null id drops it", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Baseline ${sandbox.label}` });

    await postJson(admin, "/api/goal", {
      target: "BASELINE", goalId, timestamp: Date.now(),
      baseline: { unit: "ton", dateValues: yearlyDateValues([4, 4]) },
    }, 200);
    const added = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => typeof goal?.baseline_id === "string");
    const firstBaselineId = added?.baseline_id;
    expect(firstBaselineId).toEqual(expect.any(String));
    expect(seriesValues(added?.baseline)).toEqual([4, 4]);

    await putJson(admin, "/api/goal", {
      target: "BASELINE", goalId, timestamp: Date.now(),
      baseline: { unit: "ton", dateValues: yearlyDateValues([6, 6, 6]) },
    }, 200);
    const replaced = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => seriesValues(goal?.baseline).length === 3);
    expect(replaced?.baseline_id, "a payload creates a fresh baseline series").not.toBe(firstBaselineId);
    expect(seriesValues(replaced?.baseline)).toEqual([6, 6, 6]);

    await putJson(admin, "/api/goal", { target: "BASELINE", goalId, timestamp: Date.now(), baselineId: null }, 200);
    await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => goal?.baseline_id === null, "the baseline to be dropped");
  });

  test("HISTORICAL: POST with a payload connects a historical series, PUT without one disconnects it", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Historical ${sandbox.label}` });

    await postJson(admin, "/api/goal", {
      target: "HISTORICAL", goalId, timestamp: Date.now(),
      historical: { unit: "ton", dateValues: yearlyDateValues([1, 2], 2010) },
    }, 200);
    const added = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => typeof goal?.historical_id === "string");
    expect(seriesValues(added?.historical)).toEqual([1, 2]);

    await putJson(admin, "/api/goal", { target: "HISTORICAL", goalId, timestamp: Date.now() }, 200);
    await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => goal?.historical_id === null, "the historical series to be disconnected");
  });

  test("RECIPE_SUGGESTIONS: POST sets the suggested recipes, PUT replaces the set, an empty set clears it", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Suggestions ${sandbox.label}` });
    const recipes = (goal: Record<string, unknown> | null) => (goal?.recipe_suggestions as { recipe: string }[] ?? []).map(r => r.recipe);

    await postJson(admin, "/api/goal", {
      target: "RECIPE_SUGGESTIONS", goalId, timestamp: Date.now(),
      recipeSuggestions: [scalarRecipe(`One ${sandbox.label}`, 1)],
    }, 200);
    const added = recipes(await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => recipes(goal).length === 1));
    expect(added[0]).toContain(`One ${sandbox.label}`);

    await putJson(admin, "/api/goal", {
      target: "RECIPE_SUGGESTIONS", goalId, timestamp: Date.now(),
      recipeSuggestions: [scalarRecipe(`Two ${sandbox.label}`, 2), scalarRecipe(`Three ${sandbox.label}`, 3)],
    }, 200);
    const replaced = recipes(await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => recipes(goal).length === 2));
    expect(replaced.join()).not.toContain(`One ${sandbox.label}`);

    await putJson(admin, "/api/goal", { target: "RECIPE_SUGGESTIONS", goalId, timestamp: Date.now(), recipeSuggestions: [] }, 200);
    await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => recipes(goal).length === 0, "the suggestions to be cleared");
  });

  test("a sectional write may not carry an iterationId", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Pinned ${sandbox.label}` });
    const response = await admin.post("/api/goal", {
      data: { target: "DATA_SERIES", goalId, timestamp: Date.now(), iterationId: sandbox.iterationId, dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } },
    });
    expect(response.status(), await response.text()).toBe(400);
  });

  test("a view-only member cannot write a section (403), anonymous gets 401", async ({ admin, anita, anon, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Locked ${sandbox.label}` });
    const body = { target: "DATA_SERIES", goalId, timestamp: Date.now(), dataSeries: { unit: "ton", dateValues: yearlyDateValues([1]) } };

    const forbidden = await anita.put("/api/goal", { data: body });
    expect(forbidden.status(), await forbidden.text()).toBe(403);
    const anonymous = await anon.put("/api/goal", { data: body });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
  });
});

test.describe("Full update", () => {
  test("PUT FULL updates the meta fields and answers 200 with a Location", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Before ${sandbox.label}` });
    const response = await admin.put("/api/goal", {
      data: { target: "FULL", goalId, timestamp: Date.now(), name: `After ${sandbox.label}`, description: "changed", listing: "UNLISTED" },
    });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["location"]).toBe(`/goal/${goalId}`);

    const goal = await pageEntityWhen(admin, `/goal/${goalId}`, goalId, entity => entity?.name === `After ${sandbox.label}`);
    expect(goal?.description).toBe("changed");
    expect(goal?.listing).toBe("UNLISTED");
    expect(seriesValues(goal?.data_series), "an omitted section is left alone").toEqual([1, 2, 3, 4, 5]);
  });

  test("a stale timestamp answers 409 and changes nothing", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Stale ${sandbox.label}` });
    const response = await admin.put("/api/goal", {
      data: { target: "FULL", goalId, timestamp: Date.now() - 24 * 60 * 60 * 1000, name: "should not stick" },
    });
    const text = await response.text();
    expect(response.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/stale/i);

    const sectional = await admin.post("/api/goal", {
      data: { target: "BASELINE", goalId, timestamp: 1, baseline: { unit: "ton", dateValues: yearlyDateValues([1]) } },
    });
    expect(sectional.status(), `sectional with a stale timestamp: ${await sectional.text()}`).toBe(409);

    const goal = await pageEntity(admin, `/goal/${goalId}`, goalId);
    expect(goal?.name).toBe(`Stale ${sandbox.label}`);
  });

  test("a blank name is stored as null and the page falls back to the indicator leaf", async ({ admin, sandbox }) => {
    const leaf = `Leaf ${sandbox.label}`;
    const goalId = await createGoal(admin, sandbox.iterationId, { name: "   ", indicatorParameter: `Api\\Branch\\${leaf}` });

    const goal = await pageEntity(admin, `/goal/${goalId}`, goalId);
    expect(goal?.name).toBeNull();
    // The page's own <h1> (a server component) travels as an element tuple in the payload
    expect(await flightPayload(admin, `/goal/${goalId}`)).toMatch(new RegExp(`"h1",null,\\{.{0,200}?"children":"${leaf}"`));

    // Blanking a named goal clears the name too
    await putJson(admin, "/api/goal", { target: "FULL", goalId, timestamp: Date.now(), name: `Named ${sandbox.label}` });
    await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => goal?.name === `Named ${sandbox.label}`);
    await putJson(admin, "/api/goal", { target: "FULL", goalId, timestamp: Date.now(), name: "" });
    await pageEntityWhen(admin, `/goal/${goalId}`, goalId, goal => goal?.name === null, "the blanked name to be null");
  });
});

test.describe("Copies", () => {
  test("a second copy of the same goal into the same iteration answers 409", async ({ admin, sandbox }) => {
    const sourceId = await createGoal(admin, sandbox.iterationId, { name: `Source ${sandbox.label}`, dateValues: yearlyDateValues([10, 20, 30]) });
    const sourceSeriesId = (await pageEntity(admin, `/goal/${sourceId}`, sourceId))?.data_series_id as string;
    expect(sourceSeriesId).toEqual(expect.any(String));

    // The copy flow names the goal it copies and links the source series through its recipe
    const copyBody = () => fullGoalBody(sandbox.iterationId, `${sandbox.label} copy`, {
      copiedFromGoalId: sourceId,
      indicatorParameter: `Copy\\${sandbox.label}`,
      dataSeriesRecipe: linkedScalarRecipe({ dataSeriesId: sourceSeriesId, unit: "ton", scalar: 0.5 }),
      dataSeries: { unit: "ton", dateValues: yearlyDateValues([5, 10, 15]) },
    });

    const first = await admin.post("/api/goal", { data: copyBody() });
    expect(first.status(), await first.text()).toBe(201);

    const second = await admin.post("/api/goal", { data: copyBody() });
    const text = await second.text();
    expect(second.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toEqual(expect.any(String));

    // Only declared copies are checked: the same recipe without `copiedFromGoalId` is whatever the user made it
    const derived = await admin.post("/api/goal", { data: { ...copyBody(), copiedFromGoalId: null } });
    expect(derived.status(), await derived.text()).toBe(201);
  });

  test("a recipe linking a series the user cannot read is IllegalSource (403)", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    // A roadmap shared with no group at all: invisible to anita, readable by the super admin
    const hiddenRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Hidden ${sandbox.label}`, access: { sharing: "GROUPS", grants: [] } });
    // A roadmap anita may edit through her group's RW grant
    const editableRoadmapId = await createRoadmap(admin, sandbox.orgId, { name: `Editable ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const hiddenIterationId = await createIteration(admin, hiddenRoadmapId);
      const hiddenGoalId = await createGoal(admin, hiddenIterationId, { name: `Hidden goal ${sandbox.label}` });
      const hiddenSeriesId = (await pageEntity(admin, `/goal/${hiddenGoalId}`, hiddenGoalId))?.data_series_id as string;
      expect(await pageStatus(anita, `/goal/${hiddenGoalId}`), "anita cannot see the hidden goal").toBe(404);

      const editableIterationId = await createIteration(admin, editableRoadmapId);
      const body = fullGoalBody(editableIterationId, sandbox.label, {
        dataSeriesRecipe: linkedScalarRecipe({ dataSeriesId: hiddenSeriesId, unit: "ton", scalar: 2 }),
        dataSeries: { unit: "ton", dateValues: yearlyDateValues([2, 4, 6, 8, 10]) },
      });

      const refused = await anita.post("/api/goal", { data: body });
      const text = await refused.text();
      expect(refused.status(), text).toBe(403);
      expect((JSON.parse(text) as { message: string }).message).toMatch(/data series/i);

      // The same body from someone who can read the series goes through
      const allowed = await admin.post("/api/goal", { data: body });
      expect(allowed.status(), await allowed.text()).toBe(201);

      // ...and a sectional write linking it is refused the same way
      const ownGoalId = await createGoal(anita, editableIterationId, { name: `Own ${sandbox.label}` });
      const sectional = await anita.put("/api/goal", {
        data: {
          target: "BASELINE", goalId: ownGoalId, timestamp: Date.now(),
          baselineRecipe: linkedScalarRecipe({ dataSeriesId: hiddenSeriesId, unit: "ton", scalar: 1 }),
          baseline: { unit: "ton", dateValues: yearlyDateValues([1]) },
        },
      });
      expect(sectional.status(), await sectional.text()).toBe(403);
    }
    finally {
      await deleteRoadmap(admin, editableRoadmapId);
      await deleteRoadmap(admin, hiddenRoadmapId);
    }
  });
});

test.describe("Delete", () => {
  test("DELETE cascades: the page 404s, the effect leaves the action, a like 404s, the series is gone", async ({ admin, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Doomed ${sandbox.label}` });
    const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
    await createEffect(admin, goalId, actionId);
    const seriesId = (await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series_id as string;

    const liked = await admin.post("/api/goal-like", { data: { goalId } });
    expect(liked.status(), await liked.text()).toBe(200);
    const effectGoals = (action: Record<string, unknown> | null) => (action?.effects as { goal_id: string }[] ?? []).map(effect => effect.goal_id);
    expect(effectGoals(await pageEntity(admin, `/action/${actionId}`, actionId)), "the action lists the goal's effect").toContain(goalId);

    const response = await admin.delete("/api/goal", { data: { id: goalId } });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["location"]).toBe(`/roadmap/${sandbox.roadmapId}/v1`);

    await expectPageStatus(admin, `/goal/${goalId}`, 404);
    await expect.poll(async () => effectGoals(await pageEntity(admin, `/action/${actionId}`, actionId)), { message: "the effect went with the goal", timeout: 60_000 }).not.toContain(goalId);
    const like = await admin.post("/api/goal-like", { data: { goalId } });
    expect(like.status(), await like.text()).toBe(404);
    const recalculate = await admin.post("/api/recalculate", { data: { dataSeriesId: seriesId } });
    expect(recalculate.status(), `the series went with the goal: ${await recalculate.text()}`).toBe(403);

    await deleteGoal(admin, goalId, 403);
  });

  test("DELETE needs edit access and a body", async ({ admin, anita, anon, sandbox }) => {
    const goalId = await createGoal(admin, sandbox.iterationId, { name: `Kept ${sandbox.label}` });

    const anonymous = await anon.delete("/api/goal", { data: { id: goalId } });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    await deleteGoal(anita, goalId, 403);
    const missing = await admin.delete("/api/goal", { data: {} });
    expect(missing.status(), await missing.text()).toBe(400);

    expect(await pageStatus(admin, `/goal/${goalId}`)).toBe(200);
  });
});
