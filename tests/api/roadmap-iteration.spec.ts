import { expect, test } from "../lib/users";
import {
  createGoal, createIteration, createRoadmap, deleteIteration, deleteRoadmap, expectPageStatus, flightPayload, groupIdByName, pageEntity, pageEntityWhen, pageRedirect, pageStatus, postJson, putJson, Seed, yearlyDateValues,
} from "../lib/api";

/*
 * Contract of /api/roadmap-iteration: versions are server-assigned and reachable
 * as `/roadmap/<id>/v<n>`, `latest` is the newest published one, drafts are
 * hidden from non-editors, the `/iteration/<id>` compatibility route redirects
 * to the slug, nested goals, stale timestamps and who may delete what.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

/** PUT /api/roadmap-iteration with a fresh timestamp */
function update(iterationId: string, fields: Record<string, unknown>) {
  return { iterationId, timestamp: Date.now(), goals: null, ...fields };
}

const NIL = "00000000-0000-0000-0000-000000000000";

test.describe("Versions", () => {
  test("versions auto-increment and answer on their slug; latest follows the newest published one", async ({ admin, sandbox }) => {
    const response = await admin.post("/api/roadmap-iteration", { data: { roadmapId: sandbox.roadmapId, description: "second", targetVersion: null, status: "PUBLISHED", goals: null } });
    const text = await response.text();
    expect(response.status(), text).toBe(201);
    const v2 = (JSON.parse(text) as { id: string }).id;
    expect(response.headers()["location"]).toBe(`/roadmap/${sandbox.roadmapId}/v2`);

    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/v1`)).toBe(200);
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/v2`)).toBe(200);
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/v3`)).toBe(404);
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/2`), "only v<n> and latest are slugs").toBe(404);

    const latest = await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/latest`, v2);
    expect(latest?.version).toBe(2);
    expect(latest?.description).toBe("second");
    expect(latest?.published_at, "publishing stamps published_at").toEqual(expect.stringMatching(/^\$D/));
  });

  test("targetVersion is stored as sent and need not be unique", async ({ admin, sandbox }) => {
    const first = await createIteration(admin, sandbox.roadmapId, { targetVersion: 1, status: "DRAFT" });
    const second = await createIteration(admin, sandbox.roadmapId, { targetVersion: 1, status: "DRAFT" });
    expect((await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/v2`, first))?.target_version).toBe(1);
    expect((await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/v3`, second))?.target_version).toBe(1);
  });

  test("a draft is hidden from non-editors and never latest until it is published", async ({ admin, anita, anon, sandbox }) => {
    const draftId = await createIteration(admin, sandbox.roadmapId, { status: "DRAFT" });
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/v2`), "the editor sees the draft").toBe(200);
    expect(await pageStatus(anita, `/roadmap/${sandbox.roadmapId}/v2`), "a view-only member does not").toBe(404);
    expect(await pageStatus(anon, `/roadmap/${sandbox.roadmapId}/v2`)).toBe(404);
    expect((await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/latest`, sandbox.iterationId))?.version, "latest skips drafts even for editors").toBe(1);
    expect(await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/latest`, draftId)).toBeNull();

    await putJson(admin, "/api/roadmap-iteration", update(draftId, { status: "PUBLISHED" }));
    await expectPageStatus(anita, `/roadmap/${sandbox.roadmapId}/v2`, 200);
    await pageEntityWhen(admin, `/roadmap/${sandbox.roadmapId}/latest`, draftId, latest => latest?.version === 2, "latest to move to the published v2");

    // Back to draft hides it again (published_at stays as history)
    await putJson(admin, "/api/roadmap-iteration", update(draftId, { status: "DRAFT" }));
    await expectPageStatus(anita, `/roadmap/${sandbox.roadmapId}/v2`, 404);
    const unpublished = await pageEntityWhen(admin, `/roadmap/${sandbox.roadmapId}/v2`, draftId,
      iteration => iteration?.status === "DRAFT" && iteration.published_at !== null, "v2 back in draft (the pre-publish render is also DRAFT, so wait for the stamped one)");
    expect(unpublished?.published_at).toEqual(expect.stringMatching(/^\$D/));
  });

  test("deleting the newest version frees its number for the next one", async ({ admin, sandbox }) => {
    const v2 = await createIteration(admin, sandbox.roadmapId, { status: "DRAFT" });
    await deleteIteration(admin, v2);
    const response = await admin.post("/api/roadmap-iteration", { data: { roadmapId: sandbox.roadmapId, description: "again", targetVersion: null, status: "DRAFT", goals: null } });
    expect(response.status(), await response.text()).toBe(201);
    expect(response.headers()["location"], "versions are max + 1, not a counter").toBe(`/roadmap/${sandbox.roadmapId}/v2`);
  });

  // Known bug: the next version is read as max + 1 outside a transaction, so parallel creates
  // collide on the (roadmap_id, version) unique key and the P2002 surfaces as a 500.
  test("parallel creates get distinct versions or a 409, never a 500", async ({ admin, sandbox }) => {
    test.fail(true, "POST /api/roadmap-iteration answers 500 on a version collision (unhandled P2002)");
    const responses = await Promise.all(Array.from({ length: 5 }, () => admin.post("/api/roadmap-iteration", {
      data: { roadmapId: sandbox.roadmapId, description: null, targetVersion: null, status: "DRAFT", goals: null },
    })));
    const statuses = responses.map(response => response.status());
    expect(statuses.every(status => status === 201 || status === 409), `statuses ${statuses.join(", ")}`).toBe(true);
    const locations = responses.filter(response => response.status() === 201).map(response => response.headers()["location"]);
    expect(new Set(locations).size).toBe(locations.length);
  });

  test("a roadmap without a published iteration has no latest", async ({ admin, sandbox }) => {
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Draft only ${sandbox.label}` });
    try {
      await createIteration(admin, id, { status: "DRAFT" });
      expect(await pageStatus(admin, `/roadmap/${id}/v1`)).toBe(200);
      expect(await pageStatus(admin, `/roadmap/${id}/latest`)).toBe(404);
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});

test.describe("Compatibility route", () => {
  test("/roadmap/<id>/iteration/<iterationId> redirects to the version slug, also with a wrong roadmap id", async ({ admin, anita, sandbox }) => {
    expect(await pageRedirect(admin, `/roadmap/${sandbox.roadmapId}/iteration/${sandbox.iterationId}`)).toBe(`/roadmap/${sandbox.roadmapId}/v1`);
    expect(await pageRedirect(admin, `/roadmap/${NIL}/iteration/${sandbox.iterationId}`), "the iteration's own roadmap wins").toBe(`/roadmap/${sandbox.roadmapId}/v1`);
    expect(await pageRedirect(admin, `/roadmap/${sandbox.roadmapId}/iteration/${NIL}`)).toBeNull();
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}/iteration/${NIL}`)).toBe(404);

    const draftId = await createIteration(admin, sandbox.roadmapId, { status: "DRAFT" });
    expect(await pageRedirect(admin, `/roadmap/${sandbox.roadmapId}/iteration/${draftId}`)).toBe(`/roadmap/${sandbox.roadmapId}/v2`);
    expect(await pageRedirect(anita, `/roadmap/${sandbox.roadmapId}/iteration/${draftId}`), "a draft is not found for non-editors").toBeNull();
    expect(await pageStatus(anita, `/roadmap/${sandbox.roadmapId}/iteration/${draftId}`)).toBe(404);
  });
});

test.describe("Create", () => {
  test("nested goals are created with the iteration; an invalid nested goal is 400", async ({ admin, sandbox }) => {
    const goalName = `Nested ${sandbox.label}`;
    const { id } = await postJson(admin, "/api/roadmap-iteration", {
      roadmapId: sandbox.roadmapId, description: null, targetVersion: null, status: "PUBLISHED",
      goals: [{ target: "FULL", iterationId: sandbox.iterationId, name: goalName, description: null, indicatorParameter: `Nested\\${sandbox.label}`, rawTags: null, dataSeries: { unit: "ton", dateValues: yearlyDateValues([1, 2]) } }],
    });
    const iteration = await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/v2`, id ?? "");
    const goals = iteration?.goals as { name: string, roadmap_iteration_id: string }[];
    expect(goals.map(goal => goal.name)).toEqual([goalName]);
    expect(goals[0].roadmap_iteration_id, "nested goals land in the new iteration, whatever iterationId they name").toBe(id);

    const invalid = await admin.post("/api/roadmap-iteration", {
      data: { roadmapId: sandbox.roadmapId, description: null, targetVersion: null, status: "PUBLISHED", goals: [{ target: "FULL", iterationId: sandbox.iterationId, indicatorParameter: "x" }] },
    });
    expect(invalid.status(), await invalid.text()).toBe(400);
  });

  test("status defaults to DRAFT and an invalid status is 400", async ({ admin, anita, sandbox }) => {
    const { id } = await postJson(admin, "/api/roadmap-iteration", { roadmapId: sandbox.roadmapId, description: null, targetVersion: null, goals: null });
    expect((await pageEntity(admin, `/roadmap/${sandbox.roadmapId}/v2`, id ?? ""))?.status).toBe("DRAFT");
    expect(await pageStatus(anita, `/roadmap/${sandbox.roadmapId}/v2`)).toBe(404);

    const invalid = await admin.post("/api/roadmap-iteration", { data: { roadmapId: sandbox.roadmapId, status: "UNLISTED", goals: null } });
    expect(invalid.status(), await invalid.text()).toBe(400);
    const noRoadmap = await admin.post("/api/roadmap-iteration", { data: { status: "DRAFT", goals: null } });
    expect(noRoadmap.status(), await noRoadmap.text()).toBe(400);
  });

  test("creating needs edit access to the roadmap: view-only member 403, orgless 403, unknown roadmap 403, anonymous 401", async ({ anita, orgless, anon, sandbox }) => {
    const body = { roadmapId: sandbox.roadmapId, description: null, targetVersion: null, status: "DRAFT", goals: null };
    const member = await anita.post("/api/roadmap-iteration", { data: body });
    expect(member.status(), await member.text()).toBe(403);
    const nobody = await orgless.post("/api/roadmap-iteration", { data: body });
    expect(nobody.status(), await nobody.text()).toBe(403);
    const unknown = await anita.post("/api/roadmap-iteration", { data: { ...body, roadmapId: NIL } });
    expect(unknown.status(), await unknown.text()).toBe(403);
    const anonymous = await anon.post("/api/roadmap-iteration", { data: body });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
  });

  test("a read-write grant may add versions and publish them", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const id = await createRoadmap(admin, sandbox.orgId, { name: `RW ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const iterationId = await createIteration(anita, id, { status: "DRAFT" });
      await putJson(anita, "/api/roadmap-iteration", update(iterationId, { status: "PUBLISHED", description: "published by anita" }));
      await pageEntityWhen(admin, `/roadmap/${id}/latest`, iterationId, latest => latest?.description === "published by anita");
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});

test.describe("Update", () => {
  test("a stale timestamp answers 409, a missing one 400, and the version cannot be reassigned", async ({ admin, sandbox }) => {
    const stale = await admin.put("/api/roadmap-iteration", { data: { iterationId: sandbox.iterationId, timestamp: Date.now() - 24 * 60 * 60 * 1000, description: "stale", goals: null } });
    const text = await stale.text();
    expect(stale.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/stale/i);

    const missing = await admin.put("/api/roadmap-iteration", { data: { iterationId: sandbox.iterationId, description: "no timestamp", goals: null } });
    expect(missing.status(), await missing.text()).toBe(400);

    const reassign = await admin.put("/api/roadmap-iteration", { data: update(sandbox.iterationId, { roadmapId: NIL }) });
    expect(reassign.status(), await reassign.text()).toBe(400);

    const response = await admin.put("/api/roadmap-iteration", { data: update(sandbox.iterationId, { description: "fresh" }) });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["location"]).toBe(`/roadmap/${sandbox.roadmapId}/v1`);
    await pageEntityWhen(admin, `/roadmap/${sandbox.roadmapId}/v1`, sandbox.iterationId, iteration => iteration?.description === "fresh");
  });

  test("a view-only member cannot update (403), anonymous 401, unknown id 403", async ({ admin, anita, anon, sandbox }) => {
    const member = await anita.put("/api/roadmap-iteration", { data: update(sandbox.iterationId, { description: "nope" }) });
    expect(member.status(), await member.text()).toBe(403);
    const anonymous = await anon.put("/api/roadmap-iteration", { data: update(sandbox.iterationId, { description: "nope" }) });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    const unknown = await admin.put("/api/roadmap-iteration", { data: update(NIL, { description: "nope" }) });
    expect(unknown.status(), await unknown.text()).toBe(403);
  });

  test("PUT may add goals to an existing version", async ({ admin, sandbox }) => {
    const goalName = `Added ${sandbox.label}`;
    await putJson(admin, "/api/roadmap-iteration", update(sandbox.iterationId, {
      goals: [{ target: "FULL", iterationId: sandbox.iterationId, name: goalName, description: null, indicatorParameter: `Added\\${sandbox.label}`, rawTags: null, dataSeries: { unit: "ton", dateValues: yearlyDateValues([3]) } }],
    }));
    await expect.poll(() => flightPayload(admin, `/roadmap/${sandbox.roadmapId}/v1`), { timeout: 60_000 }).toContain(`"name":"${goalName}"`);
  });
});

test.describe("Delete", () => {
  test("editors may delete drafts, only managers published versions; the goals go with it", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Versions ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      const published = await createIteration(admin, id, { status: "PUBLISHED" });
      const goalId = await createGoal(admin, published, { name: `Goal ${sandbox.label}` });
      const draft = await createIteration(admin, id, { status: "DRAFT" });

      await deleteIteration(anita, published, 403);
      await deleteIteration(anita, draft);
      await expectPageStatus(admin, `/roadmap/${id}/v2`, 404);

      const response = await admin.delete("/api/roadmap-iteration", { data: { id: published } });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["location"]).toBe(`/roadmap/${id}`);
      await expectPageStatus(admin, `/roadmap/${id}/v1`, 404);
      await expectPageStatus(admin, `/goal/${goalId}`, 404);
      await deleteIteration(admin, published, 403);

      const missing = await admin.delete("/api/roadmap-iteration", { data: {} });
      expect(missing.status(), await missing.text()).toBe(400);
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});
