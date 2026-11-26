import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";
import {
  createAction, createEffect, createGoal, createIteration, createRoadmap, deleteRoadmap, flightPayload, freshTimestamp,
  groupIdByName, linkedScalarRecipe, orgIdByName, pageEntity, pageStatus, postJson, putJson, Seed, seriesValues, yearlyDateValues,
} from "../lib/api";
import { freshContext, linkLogin, uniqueEmail } from "../lib/login-link";

/*
 * Cache tags, request-only: what a write must expire in the `'use cache'` readers
 * (caching.md, "Rules"). The browser side of the same contract (Activity re-show,
 * revalidation over client navigation) is tests/e2e/caching.spec.ts.
 *
 * Every test warms the reader's entry for the user first and then reads back ONCE
 * after the write, without polling: a reader that misses a tag keeps serving its
 * entry for minutes, and so does one that is only marked stale. A poll would hide both.
 *
 * Each test that needs a roadmap builds its own. The org rename uses a seeded place org that no
 * other spec looks up by name and restores it in `finally`.
 */

/** Reads every page twice as every user, so the next read is served from a warm entry */
async function warm(read: () => Promise<void>): Promise<void> {
  await read();
  await read();
}

async function expectStatuses(request: APIRequestContext, pages: string[], status: number, who: string): Promise<void> {
  for (const page of pages) {
    expect(await pageStatus(request, page), `${who}: ${page}`).toBe(status);
  }
}

/** The effect edit page delivers the form (with the effect) to editors and a notice to everyone else */
async function effectFormShown(request: APIRequestContext, editPage: string): Promise<boolean> {
  return (await flightPayload(request, editPage)).includes('"currentEffect":{');
}

test.describe("sharing and status changes reach every reader under the roadmap", () => {
  test("narrowed sharing hides the roadmap, version, goal, action and effect on the next read; widened sharing shows them", async ({ admin, anita, anon, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const editors: { groupId: string, accessLevel: "RW" }[] = [{ groupId, accessLevel: "RW" }];
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Cache sharing ${sandbox.label}`, access: { sharing: "PUBLIC", grants: editors } });
    const share = (sharing: "GROUPS" | "PUBLIC", grants: typeof editors) =>
      putJson(admin, "/api/roadmap", { id, access: { sharing, grants }, timestamp: freshTimestamp() });
    try {
      const iterationId = await createIteration(admin, id);
      const goalId = await createGoal(admin, iterationId, { name: `Goal ${sandbox.label}` });
      const actionId = await createAction(admin, iterationId, { name: `Action ${sandbox.label}` });
      await createEffect(admin, goalId, actionId);
      const pages = [`/roadmap/${id}`, `/roadmap/${id}/v1`, `/goal/${goalId}`, `/action/${actionId}`];
      const editPage = `/effect/${actionId}/${goalId}/edit`;

      // PUBLIC with a read-write grant: everyone reads, anita (in the group) edits
      await warm(async () => {
        await expectStatuses(anon, pages, 200, "anonymous under PUBLIC");
        await expectStatuses(anita, pages, 200, "group member under PUBLIC");
        expect(await effectFormShown(anita, editPage), "group member with RW: effect form").toBe(true);
      });

      // Narrowed to GROUPS without a grant: gone for both on the very next read
      await share("GROUPS", []);
      await expectStatuses(anon, pages, 404, "anonymous after narrowing");
      await expectStatuses(anita, pages, 404, "former group member after narrowing");
      expect(await effectFormShown(anita, editPage), "former group member: effect form").toBe(false);

      // The 404s are warm now. Widened to the group: back for anita, still hidden for anonymous
      await warm(async () => {
        await expectStatuses(anon, pages, 404, "anonymous under GROUPS");
        await expectStatuses(anita, pages, 404, "member without a grant under GROUPS");
      });
      await share("GROUPS", editors);
      await expectStatuses(anita, pages, 200, "group member after the grant");
      expect(await effectFormShown(anita, editPage), "group member after the grant: effect form").toBe(true);
      await expectStatuses(anon, pages, 404, "anonymous after the grant");

      // Widened to PUBLIC: back for anonymous too
      await share("PUBLIC", editors);
      await expectStatuses(anon, pages, 200, "anonymous after widening");
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("unpublishing a version hides its goals and actions from readers on the next read; publishing shows them", async ({ admin, anon, sandbox }) => {
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Cache status ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [] } });
    try {
      const iterationId = await createIteration(admin, id);
      const goalId = await createGoal(admin, iterationId, { name: `Goal ${sandbox.label}` });
      const actionId = await createAction(admin, iterationId, { name: `Action ${sandbox.label}` });
      const pages = [`/roadmap/${id}/v1`, `/goal/${goalId}`, `/action/${actionId}`];
      const setStatus = (status: "DRAFT" | "PUBLISHED") =>
        putJson(admin, "/api/roadmap-iteration", { iterationId, status, goals: null, timestamp: freshTimestamp() });

      await warm(() => expectStatuses(anon, pages, 200, "anonymous, published"));
      await setStatus("DRAFT");
      await expectStatuses(anon, pages, 404, "anonymous after unpublishing");

      await warm(() => expectStatuses(anon, pages, 404, "anonymous, draft"));
      await setStatus("PUBLISHED");
      await expectStatuses(anon, pages, 200, "anonymous after publishing");
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});

test.describe("names shown from other tables", () => {
  // A seeded place org no other spec looks up by name
  const orgName = "Region Norrbotten";

  /** The names the page's readers returned for the org with the access controls it owns: one name when they agree */
  async function ownerNames(request: APIRequestContext, url: string, orgId: string): Promise<string[]> {
    const text = await flightPayload(request, url);
    const names = Array.from(text.matchAll(new RegExp(`"access_control":\\{"id":"[0-9a-f-]{36}","org_id":"${orgId}","org":\\{"name":"([^"]*)"\\}`, "g")), match => match[1]);
    return [...new Set(names)].sort();
  }

  test("an org rename shows on the next read of the roadmap, goal and action pages", async ({ admin, sandbox }) => {
    const orgId = await orgIdByName(admin, orgName);
    const newName = `${orgName} ${sandbox.label}`;
    const id = await createRoadmap(admin, orgId, { name: `Cache org ${sandbox.label}`, access: { sharing: "ORG", grants: [] } });
    try {
      const iterationId = await createIteration(admin, id);
      const goalId = await createGoal(admin, iterationId, { name: `Goal ${sandbox.label}` });
      const actionId = await createAction(admin, iterationId, { name: `Action ${sandbox.label}` });
      const pages = [`/roadmap/${id}`, `/roadmap/${id}/v1`, `/goal/${goalId}`, `/action/${actionId}`];
      const names = async () => Promise.all(pages.map(page => ownerNames(admin, page, orgId)));

      await warm(async () => expect(await names()).toEqual(pages.map(() => [orgName])));
      try {
        await putJson(admin, "/api/org", { orgId, name: newName });
        expect(await names(), "after the rename").toEqual(pages.map(() => [newName]));
      }
      finally {
        await putJson(admin, "/api/org", { orgId, name: orgName });
      }
      expect(await names(), "after the restore").toEqual(pages.map(() => [orgName]));
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});

test.describe("accounts", () => {
  /*
   * Only the account's existence is pinned. A changed name on bylines is not: the content readers are
   * deliberately not tagged `user` (caching.md, "Author names (bylines) are not tagged").
   */
  test("a new account's profile page exists on the next read", async ({ admin, playwright, baseURL }, testInfo) => {
    const email = uniqueEmail("cached");
    const profile = `/user/${encodeURIComponent(email.split("@")[0])}`;
    const member = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      // Nobody has that username yet, and admin's "not found" is warm
      await warm(async () => expect(await pageStatus(admin, profile), "before the account exists").toBe(404));
      await linkLogin(member, email);
      expect(await pageStatus(admin, profile), "right after the first login").toBe(200);
    }
    finally {
      await member.dispose();
    }
  });
});

test.describe("recalculation", () => {
  test("the recalculated values show on the next read, and a chained recalculation reads them", async ({ admin, sandbox }) => {
    const { iterationId, label } = sandbox;
    const seriesId = async (goalId: string) => (await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series_id as string;
    const values = async (goalId: string) => seriesValues((await pageEntity(admin, `/goal/${goalId}`, goalId))?.data_series);
    /** A goal computed as `<source series> * scalar`; the form sends the evaluated values along */
    const derived = async (name: string, sourceSeriesId: string, scalar: number, evaluated: number[]) => (await postJson(admin, "/api/goal", {
      target: "FULL", iterationId, name: `${name} ${label}`, description: null, indicatorParameter: `${name}\\${label}`, rawTags: null,
      dataSeriesRecipe: linkedScalarRecipe({ dataSeriesId: sourceSeriesId, unit: "ton", scalar }),
      dataSeries: { unit: "ton", dateValues: yearlyDateValues(evaluated) },
    })).id ?? "";

    // parent (manual) → child = parent × 2 → grandchild = child × 3
    const parentId = await createGoal(admin, iterationId, { name: `Parent ${label}`, dateValues: yearlyDateValues([10, 20, 30]) });
    const childId = await derived("Child", await seriesId(parentId), 2, [20, 40, 60]);
    const childSeriesId = await seriesId(childId);
    const grandchildId = await derived("Grandchild", childSeriesId, 3, [60, 120, 180]);
    const grandchildSeriesId = await seriesId(grandchildId);
    const recalculate = async (dataSeriesId: string) => {
      const response = await admin.post("/api/recalculate", { data: { dataSeriesId } });
      expect(response.status(), await response.text()).toBe(200);
    };

    // Recalculating warms the evaluator's own read of the child series (and changes nothing yet)
    await warm(async () => {
      await recalculate(grandchildSeriesId);
      expect(await values(childId)).toEqual([20, 40, 60]);
      expect(await values(grandchildId)).toEqual([60, 120, 180]);
    });

    await putJson(admin, "/api/goal", { target: "DATA_SERIES", goalId: parentId, timestamp: freshTimestamp(), dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2, 3, 4]) } });
    expect(await values(parentId), "the parent's own edit").toEqual([1, 2, 3, 4]);
    expect(await values(childId), "nothing moves until recalculated").toEqual([20, 40, 60]);

    // Back to back: the second recalculation's input is the series the first one just wrote
    await recalculate(childSeriesId);
    await recalculate(grandchildSeriesId);
    expect(await values(grandchildId), "grandchild, first read after the chain").toEqual([6, 12, 18, 24]);
    expect(await values(childId), "child, first read after its recalculation").toEqual([2, 4, 6, 8]);
  });
});
