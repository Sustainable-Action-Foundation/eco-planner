import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";
import { createGoal, createIteration, createRoadmap, deleteGoal, deleteRoadmap, expectPageStatus, freshTimestamp, groupIdByName, pageEntity, pageStatus, postJson, putJson, Seed, seriesValues, yearlyDateValues } from "../lib/api";
import type { PageEntity } from "../lib/api";

/*
 * A goal's series can be computed by a recipe from other stored series: a goal copied and scaled
 * from a goal of another roadmap reads that goal's series. The copy's own values belong to the
 * copy and show wherever the copy shows. The series it reads (the original's values and id, and
 * the recipe, which names the original) belongs to the original: whoever may not open the
 * original must not get it through the copy, anonymous visitors included.
 *
 * Each test builds a PUBLIC roadmap for the copy and a closed one for the original in the
 * fixtures org and reads the pages as anonymous and orgless (see only the public side),
 * anita (member of the org, in its group) and admin.
 */

test.slow(true, "streamed page reads against the shared dev server");

/** Values no other fixture produces, so the original's series can be searched for in a payload */
const SOURCE_SERIES = [515151.5, 525252.5, 535353.5];
/** The copy is the original times this; its values are the copy's own and stay visible */
const FACTOR = 2;
const COPY_SERIES = SOURCE_SERIES.map(value => value * FACTOR);

/**
 * The whole response of a page, as sent: every streamed chunk, escaped as on the wire.
 * Assert on it with `includes` (not `toContain`): a failure would print megabytes of page.
 */
async function pageBody(request: APIRequestContext, url: string): Promise<string> {
  const response = await request.get(url);
  expect(response.status(), `GET ${url}`).toBe(200);
  return await response.text();
}

/**
 * The recipe the goal form stores for a copy (`goalPrefilledSeries` + `withParentSeries`): a
 * variable linked to the original's series, labelled with the original's name, which the
 * equation refers to by that name.
 */
function copyRecipe(original: { name: string, dataSeriesId: string }, factor: number): string {
  return JSON.stringify({
    name: "Scaled copy",
    equation: `\${${original.name}} * \${Factor}`,
    variables: [
      { id: "parent", name: original.name, type: "data-series", pick: "whole", unit: "MISSING_UNIT", dataSeriesId: original.dataSeriesId, value: null },
      { id: "factor", name: "Factor", type: "scalar", unit: "UNITLESS", value: factor },
    ],
    unit: "ton",
    meta: { v: 1, isSuggestedRecipe: true, isManual: false },
  });
}

type Original = { goalId: string, name: string, dataSeriesId: string, roadmapName: string };

/** A goal with the searchable series in the given version, as the admin */
async function createOriginal(admin: APIRequestContext, iterationId: string, label: string, roadmapName: string): Promise<Original> {
  const name = `Internal original ${label}`;
  const goalId = await createGoal(admin, iterationId, { name, dateValues: yearlyDateValues(SOURCE_SERIES) });
  const dataSeriesId = (await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series_id as string;
  expect(dataSeriesId, "the original's series id").toEqual(expect.any(String));
  return { goalId, name, dataSeriesId, roadmapName };
}

/** A copy of the original in the given version: the values the form evaluated, and the recipe that produced them */
async function createCopy(author: APIRequestContext, iterationId: string, label: string, original: Original, expectedStatus = 201): Promise<string> {
  const { id } = await postJson(author, "/api/goal", {
    target: "FULL", iterationId, name: `Open copy ${label}`, description: null, indicatorParameter: `Copy\\${label}`, rawTags: null,
    copiedFromGoalId: original.goalId,
    dataSeriesRecipe: copyRecipe(original, FACTOR),
    dataSeries: { unit: "ton", dateValues: yearlyDateValues(COPY_SERIES) },
  }, expectedStatus);
  return id ?? "";
}

/** What a page says of the original. All of it must be false for someone who may not open the original */
function tracesOfOriginal(body: string, original: Original): Record<string, boolean> {
  return {
    "the original's values": body.includes(String(SOURCE_SERIES[0])),
    "the original's series id": body.includes(original.dataSeriesId),
    "the original's goal id": body.includes(original.goalId),
    "the original's name": body.includes(original.name),
    "the original's roadmap": body.includes(original.roadmapName),
  };
}

const NO_TRACES = {
  "the original's values": false,
  "the original's series id": false,
  "the original's goal id": false,
  "the original's name": false,
  "the original's roadmap": false,
};

/** The series a goal entity's recipe is said to read, as the page carries them */
function sourceIds(goal: PageEntity | null): string[] {
  const series = goal?.data_series as { recipe_used?: { source_data_series?: { id: string }[] } } | null | undefined;
  return (series?.recipe_used?.source_data_series ?? []).map(source => source.id);
}

type World = {
  openRoadmapId: string;
  openIterationId: string;
  closedRoadmapId: string;
  closedRoadmapName: string;
  closedIterationId: string;
};

/**
 * A PUBLIC roadmap the fixtures group edits, and an ORG-shared one, each with one published
 * version: anita may copy from the second into the first.
 */
async function buildWorld(admin: APIRequestContext, orgId: string, label: string): Promise<World> {
  const groupId = await groupIdByName(admin, orgId, Seed.groupName);
  const openRoadmapId = await createRoadmap(admin, orgId, { name: `Open ${label}`, access: { sharing: "PUBLIC", grants: [{ groupId, accessLevel: "RW" }] } });
  const openIterationId = await createIteration(admin, openRoadmapId);
  const closedRoadmapName = `Internal ${label}`;
  const closedRoadmapId = await createRoadmap(admin, orgId, { name: closedRoadmapName, access: { sharing: "ORG", grants: [] } });
  const closedIterationId = await createIteration(admin, closedRoadmapId);
  return { openRoadmapId, openIterationId, closedRoadmapId, closedRoadmapName, closedIterationId };
}

async function removeWorld(admin: APIRequestContext, world: World): Promise<void> {
  await deleteRoadmap(admin, world.openRoadmapId);
  await deleteRoadmap(admin, world.closedRoadmapId);
}

test.describe("a copy's page and the series it was computed from", () => {
  test("an org-internal goal copied into a public roadmap by a member stays off the copy's page for those who cannot open the original", async ({ admin, anita, orgless, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const original = await createOriginal(admin, world.closedIterationId, sandbox.label, world.closedRoadmapName);
      // No later change is needed: anita reads the org's roadmap and edits the public one, so the API lets her link the two
      const copyId = await createCopy(anita, world.openIterationId, sandbox.label, original);

      // The premise: the copy is open to everyone, the original only to the org
      for (const [who, request, seesOriginal] of [["anonymous", anon, false], ["orgless", orgless, false], ["anita", anita, true], ["admin", admin, true]] as const) {
        expect(await pageStatus(request, `/goal/${copyId}`), `${who} opens the copy`).toBe(200);
        expect(await pageStatus(request, `/goal/${original.goalId}`), `${who} opens the original`).toBe(seesOriginal ? 200 : 404);
      }

      for (const [who, request] of [["anonymous", anon], ["orgless", orgless]] as const) {
        const body = await pageBody(request, `/goal/${copyId}`);
        expect(body.includes(`Open copy ${sandbox.label}`), `${who}: the copy's page rendered`).toBe(true);
        expect(tracesOfOriginal(body, original), `${who}: the copy's page`).toEqual(NO_TRACES);

        // The copy's own stored values are the copy's and stay
        const copy = await pageEntity(request, `/goal/${copyId}`, copyId);
        expect(seriesValues(copy?.data_series), `${who}: the copy's values`).toEqual(COPY_SERIES);
        expect(sourceIds(copy), `${who}: the series the copy reads`).toEqual([]);
      }

      // Those who may open the original still get it with the copy
      for (const [who, request] of [["anita", anita], ["admin", admin]] as const) {
        const copy = await pageEntity(request, `/goal/${copyId}`, copyId);
        expect(sourceIds(copy), `${who}: the series the copy reads`).toEqual([original.dataSeriesId]);
        expect((await pageBody(request, `/goal/${copyId}`)).includes(String(SOURCE_SERIES[0])), `${who}: the original's values`).toBe(true);
      }
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("an original in a draft version stays off the published copy's page for those who cannot see drafts", async ({ admin, anita, orgless, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      // Both in the public roadmap: only the version differs. anita edits the roadmap, so she sees its drafts
      const draftId = await createIteration(admin, world.openRoadmapId, { status: "DRAFT" });
      const original = await createOriginal(admin, draftId, sandbox.label, `Open ${sandbox.label}`);
      const copyId = await createCopy(anita, world.openIterationId, sandbox.label, original);

      for (const [who, request] of [["anonymous", anon], ["orgless", orgless]] as const) {
        expect(await pageStatus(request, `/goal/${original.goalId}`), `${who} opens the draft original`).toBe(404);
        const body = await pageBody(request, `/goal/${copyId}`);
        expect(body.includes(`Open copy ${sandbox.label}`), `${who}: the copy's page rendered`).toBe(true);
        // (the roadmap is the copy's own here, so its name is on the page)
        expect({ ...tracesOfOriginal(body, original), "the original's roadmap": false }, `${who}: the copy's page`).toEqual(NO_TRACES);
        expect(seriesValues((await pageEntity(request, `/goal/${copyId}`, copyId))?.data_series), `${who}: the copy's values`).toEqual(COPY_SERIES);
      }
      expect(sourceIds(await pageEntity(anita, `/goal/${copyId}`, copyId)), "anita: the series the copy reads").toEqual([original.dataSeriesId]);
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("the version page of the copy's roadmap carries nothing of the original either", async ({ admin, anita, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const original = await createOriginal(admin, world.closedIterationId, sandbox.label, world.closedRoadmapName);
      const copyId = await createCopy(anita, world.openIterationId, sandbox.label, original);

      const versionUrl = `/roadmap/${world.openRoadmapId}/v1`;
      const body = await pageBody(anon, versionUrl);
      expect(body.includes(`Open copy ${sandbox.label}`), "anonymous: the version page lists the copy").toBe(true);
      expect(tracesOfOriginal(body, original), "anonymous: the version page").toEqual(NO_TRACES);
      expect(sourceIds(await pageEntity(anita, versionUrl, copyId)), "anita: the series the copy reads").toEqual([original.dataSeriesId]);
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("what decides the original's visibility also refreshes the copy's page: sharing of its roadmap", async ({ admin, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      // The original starts out public: the realistic order is a copy of something open that is closed later
      await putJson(admin, "/api/roadmap", { id: world.closedRoadmapId, access: { sharing: "PUBLIC", grants: [] }, timestamp: freshTimestamp() });
      const original = await createOriginal(admin, world.closedIterationId, sandbox.label, world.closedRoadmapName);
      const copyId = await createCopy(admin, world.openIterationId, sandbox.label, original);

      /** The copy's page as the anonymous visitor gets it: the series the copy reads, and whether the page says anything of the original */
      const seen = async () => {
        const sources = sourceIds(await pageEntity(anon, `/goal/${copyId}`, copyId));
        const traces = tracesOfOriginal(await pageBody(anon, `/goal/${copyId}`), original);
        return { sources, named: traces["the original's name"], values: traces["the original's values"] };
      };
      // While the original is public, so is what the copy reads. The visitor's entry is cached
      // from here on: each change below has to expire it through its tags
      expect(await seen()).toEqual({ sources: [original.dataSeriesId], named: true, values: true });

      // The original's roadmap closes: nothing about the copy or its own roadmap changed
      await putJson(admin, "/api/roadmap", { id: world.closedRoadmapId, access: { sharing: "ORG", grants: [] }, timestamp: freshTimestamp() });
      await expect.poll(seen, { message: "the original leaves the copy's page once its roadmap is closed", timeout: 60_000 }).toEqual({ sources: [], named: false, values: false });
      expect(seriesValues((await pageEntity(anon, `/goal/${copyId}`, copyId))?.data_series), "the copy's values stay").toEqual(COPY_SERIES);

      // And opening it again brings it back
      await putJson(admin, "/api/roadmap", { id: world.closedRoadmapId, access: { sharing: "PUBLIC", grants: [] }, timestamp: freshTimestamp() });
      await expect.poll(seen, { message: "the original returns once its roadmap is public", timeout: 60_000 }).toEqual({ sources: [original.dataSeriesId], named: true, values: true });
    }
    finally {
      await removeWorld(admin, world);
    }
  });

  test("what a deleted original leaves behind goes only to those who may edit the copy", async ({ admin, anita, orgless, anon, sandbox }) => {
    const world = await buildWorld(admin, sandbox.orgId, sandbox.label);
    try {
      const original = await createOriginal(admin, world.closedIterationId, sandbox.label, world.closedRoadmapName);
      const copyId = await createCopy(anita, world.openIterationId, sandbox.label, original);

      // The goal goes, its series stays for the recipe that reads it: a series that belongs to nothing
      await deleteGoal(admin, original.goalId);
      await expectPageStatus(admin, `/goal/${original.goalId}`, 404);

      // anita edits the copy: its form evaluates the recipe from that series, so she gets both
      await expect.poll(async () => sourceIds(await pageEntity(anita, `/goal/${copyId}/edit`, copyId)), { message: "anita: the series the copy reads", timeout: 60_000 }).toEqual([original.dataSeriesId]);
      const editBody = await pageBody(anita, `/goal/${copyId}/edit`);
      expect(editBody.includes(String(SOURCE_SERIES[0])), "anita: the values the copy reads").toBe(true);
      expect(editBody.includes(original.name), "anita: the recipe as stored").toBe(true);

      // Whoever only reads the copy gets its own values and nothing of what is left of the original
      for (const [who, request] of [["anonymous", anon], ["orgless", orgless]] as const) {
        const body = await pageBody(request, `/goal/${copyId}`);
        expect(body.includes(`Open copy ${sandbox.label}`), `${who}: the copy's page rendered`).toBe(true);
        expect(tracesOfOriginal(body, original), `${who}: the copy's page`).toEqual(NO_TRACES);
        expect(seriesValues((await pageEntity(request, `/goal/${copyId}`, copyId))?.data_series), `${who}: the copy's values`).toEqual(COPY_SERIES);
      }
    }
    finally {
      await removeWorld(admin, world);
    }
  });
});

test.describe("someone who edits the copy but cannot see the original", () => {
  /** The copy in a roadmap anita edits through her group; the original under one only the org's managers read */
  async function buildClosedWorld(admin: APIRequestContext, orgId: string, label: string) {
    const groupId = await groupIdByName(admin, orgId, Seed.groupName);
    const editableRoadmapId = await createRoadmap(admin, orgId, { name: `Editable ${label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    const closedRoadmapName = `Closed ${label}`;
    const closedRoadmapId = await createRoadmap(admin, orgId, { name: closedRoadmapName, access: { sharing: "GROUPS", grants: [] } });
    const original = await createOriginal(admin, await createIteration(admin, closedRoadmapId), label, closedRoadmapName);
    const copyId = await createCopy(admin, await createIteration(admin, editableRoadmapId), label, original);
    const copySeriesId = (await pageEntity(admin, `/goal/${copyId}`, copyId))?.data_series_id as string;
    return { editableRoadmapId, closedRoadmapId, original, copyId, copySeriesId };
  }

  test("gets the copy and its values, and nothing of the original, on the goal page and in the edit form", async ({ admin, anita, sandbox }) => {
    const world = await buildClosedWorld(admin, sandbox.orgId, sandbox.label);
    try {
      expect(await pageStatus(anita, `/goal/${world.copyId}/edit`), "anita edits the copy").toBe(200);
      expect(await pageStatus(anita, `/goal/${world.original.goalId}`), "anita opens the original").toBe(404);

      for (const url of [`/goal/${world.copyId}`, `/goal/${world.copyId}/edit`]) {
        const body = await pageBody(anita, url);
        expect(body.includes(`Open copy ${sandbox.label}`), `${url} rendered`).toBe(true);
        expect(tracesOfOriginal(body, world.original), url).toEqual(NO_TRACES);
        const copy = await pageEntity(anita, url, world.copyId);
        expect(seriesValues(copy?.data_series), `${url}: the copy's values`).toEqual(COPY_SERIES);
        expect(sourceIds(copy), `${url}: the series the copy reads`).toEqual([]);
      }
    }
    finally {
      await deleteRoadmap(admin, world.editableRoadmapId);
      await deleteRoadmap(admin, world.closedRoadmapId);
    }
  });

  test("gets nothing back by passing the original's series off as fetched statistics", async ({ admin, anita, sandbox }) => {
    const world = await buildClosedWorld(admin, sandbox.orgId, sandbox.label);
    try {
      // A recipe variable that carries a statistics selection is not checked against the user's
      // read access when saved (`assertReadableLinkedSeries` skips it: materialized statistics
      // fill no slot). Whoever knows a series id could link it that way. The reader must still
      // not hand the series over: it has an owner, and anita may not see it
      const response = await anita.post("/api/goal", {
        data: {
          target: "DATA_SERIES", goalId: world.copyId, timestamp: freshTimestamp(),
          dataSeriesRecipe: JSON.stringify({
            name: "Statistics",
            equation: "${stat}", // eslint-disable-line no-template-curly-in-string -- recipe variable syntax, not a template
            variables: [{ id: "stat", name: "stat", type: "data-series", pick: "whole", unit: "ton", dataSeriesId: world.original.dataSeriesId, value: null, externalSource: { dataset: "SCB", tableId: "TAB1", selection: [] } }],
            unit: "ton",
            meta: { v: 1, isSuggestedRecipe: false, isManual: false },
          }),
          dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3]) },
        },
      });
      // Refusing the write outright would be fine too; what must hold either way is below
      expect([200, 403], await response.text()).toContain(response.status());

      for (const url of [`/goal/${world.copyId}`, `/goal/${world.copyId}/edit`]) {
        await expect.poll(async () => seriesValues((await pageEntity(anita, url, world.copyId))?.data_series), { message: `${url} after the write`, timeout: 60_000 })
          .toEqual(response.status() === 200 ? [1, 2, 3] : COPY_SERIES);
        const body = await pageBody(anita, url);
        expect(body.includes(String(SOURCE_SERIES[0])), `${url}: the original's values`).toBe(false);
        expect(body.includes(world.original.name), `${url}: the original's name`).toBe(false);
        expect(sourceIds(await pageEntity(anita, url, world.copyId)), `${url}: the series the copy reads`).toEqual([]);
      }
      // Nor does a recalculation read it for her
      const recalculation = await anita.post("/api/recalculate", { data: { dataSeriesId: world.copySeriesId } });
      expect(recalculation.status(), await recalculation.text()).toBe(403);
    }
    finally {
      await deleteRoadmap(admin, world.editableRoadmapId);
      await deleteRoadmap(admin, world.closedRoadmapId);
    }
  });

  test("cannot recompute the copy from a part of its sources: recalculation and re-linking are refused, other edits leave the series alone", async ({ admin, anita, sandbox }) => {
    const world = await buildClosedWorld(admin, sandbox.orgId, sandbox.label);
    try {
      // The original moves; the copy is stale until someone recalculates it
      const moved = SOURCE_SERIES.map(value => value + 1000);
      await putJson(admin, "/api/goal", { target: "DATA_SERIES", goalId: world.original.goalId, timestamp: freshTimestamp(), dataSeries: { unit: "ton", dateValues: yearlyDateValues(moved) } });

      /** The copy as the admin (who sees everything) reads it back: its stored values and the series its recipe reads */
      const stored = async () => {
        const copy = await pageEntity(admin, `/goal/${world.copyId}`, world.copyId);
        return { values: seriesValues(copy?.data_series), sources: sourceIds(copy) };
      };
      const untouched = { values: COPY_SERIES, sources: [world.original.dataSeriesId] };

      // anita may edit the copy, but a recalculation would have to read a series she may not: it does not run,
      // and the refusal says nothing of what it could not read
      const refused = await anita.post("/api/recalculate", { data: { dataSeriesId: world.copySeriesId } });
      const refusal = await refused.text();
      expect(refused.status(), refusal).toBe(403);
      expect(tracesOfOriginal(refusal, world.original), "the refusal").toEqual(NO_TRACES);
      // Nor may she store a recipe that reads the original, even the one already stored
      await putJson(anita, "/api/goal", {
        target: "DATA_SERIES", goalId: world.copyId, timestamp: freshTimestamp(),
        dataSeriesRecipe: copyRecipe(world.original, FACTOR), dataSeries: { unit: "ton", dateValues: yearlyDateValues(COPY_SERIES) },
      }, 403);
      // Twice: the first read after a write may still be the pre-write cache entry
      for (let read = 0; read < 2; read++) expect(await stored(), "nothing moved").toEqual(untouched);

      // An edit that does not touch the series goes through and leaves the recipe and the values as they were
      await putJson(anita, "/api/goal", { target: "FULL", goalId: world.copyId, timestamp: freshTimestamp(), name: `Renamed copy ${sandbox.label}`, description: null, indicatorParameter: `Copy\\${sandbox.label}`, rawTags: null });
      await expect.poll(async () => (await pageEntity(admin, `/goal/${world.copyId}`, world.copyId))?.name, { message: "the rename", timeout: 60_000 }).toBe(`Renamed copy ${sandbox.label}`);
      expect(await stored(), "the rename left the series alone").toEqual(untouched);

      // Someone who sees every source recalculates from all of them
      const recalculated = await admin.post("/api/recalculate", { data: { dataSeriesId: world.copySeriesId } });
      expect(recalculated.status(), await recalculated.text()).toBe(200);
      await expect.poll(async () => (await stored()).values, { message: "the recalculated copy", timeout: 60_000 }).toEqual(moved.map(value => value * FACTOR));
    }
    finally {
      await deleteRoadmap(admin, world.editableRoadmapId);
      await deleteRoadmap(admin, world.closedRoadmapId);
    }
  });
});
