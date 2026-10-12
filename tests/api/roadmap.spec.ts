import { expect, test } from "../lib/users";
import {
  createAction, createGoal, createIteration, createRoadmap, deleteRoadmap, expectPageStatus, groupIdByName, pageEntity, pageEntityWhen, pageStatus, putJson, Seed,
} from "../lib/api";

/*
 * Contract of /api/roadmap: creating with grants, what each sharing level lets
 * a member / an orgless user / an anonymous visitor read, the manager-only
 * rules (PUBLIC, `access` on update, delete), parent linking, stale timestamps
 * and the delete cascade. Readability is checked through the page routes.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

/** PUT /api/roadmap with a fresh timestamp */
function update(id: string, fields: Record<string, unknown>) {
  return { id, timestamp: Date.now(), ...fields };
}

test.describe("Create", () => {
  test("POST answers 201 with the id and a Location pointing at the iteration form", async ({ admin, sandbox }) => {
    const response = await admin.post("/api/roadmap", {
      data: { name: `Created ${sandbox.label}`, description: "<p>desc</p>", type: "MUNICIPAL", actor: "  Someone  ", geoAreaCode: null, orgId: sandbox.orgId, parentRoadmapId: null },
    });
    const text = await response.text();
    expect(response.status(), text).toBe(201);
    const id = (JSON.parse(text) as { id: string }).id;
    try {
      expect(response.headers()["location"]).toBe(`/roadmap/${id}/iteration/create`);
      const roadmap = await pageEntity(admin, `/roadmap/${id}`, id);
      expect(roadmap?.name).toBe(`Created ${sandbox.label}`);
      expect(roadmap?.type).toBe("MUNICIPAL");
      expect(roadmap?.actor, "actors are trimmed").toBe("Someone");
      expect((roadmap?.access_control as { sharing: string }).sharing, "sharing defaults to ORG").toBe("ORG");
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("an invalid body answers 400, an unknown type falls back to OTHER", async ({ admin, sandbox }) => {
    const missingName = await admin.post("/api/roadmap", { data: { description: "", orgId: sandbox.orgId } });
    expect(missingName.status(), await missingName.text()).toBe(400);
    const badGrants = await admin.post("/api/roadmap", {
      data: { name: "x", description: "", orgId: sandbox.orgId, access: { sharing: "ORG", grants: [{ groupId: 1 }] } },
    });
    expect(badGrants.status(), await badGrants.text()).toBe(400);

    const id = await createRoadmap(admin, sandbox.orgId, { name: `Typed ${sandbox.label}`, type: "BOGUS" as "OTHER" });
    try {
      expect((await pageEntity(admin, `/roadmap/${id}`, id))?.type).toBe("OTHER");
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("an orgless user cannot create (403), anonymous gets 401", async ({ orgless, anon, sandbox }) => {
    const body = { name: `Nope ${sandbox.label}`, description: "", type: "OTHER", actor: null, geoAreaCode: null, orgId: sandbox.orgId, parentRoadmapId: null };
    const forbidden = await orgless.post("/api/roadmap", { data: body });
    expect(forbidden.status(), await forbidden.text()).toBe(403);
    const anonymous = await anon.post("/api/roadmap", { data: body });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
  });

  test("a plain member must grant her own group read-write access, and only managers get NATIONAL", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const body = (access: unknown, type = "OTHER") => ({ name: `Member ${sandbox.label}`, description: "", type, actor: null, geoAreaCode: null, orgId: sandbox.orgId, access, parentRoadmapId: null });

    const noGrant = await anita.post("/api/roadmap", { data: body(undefined) });
    const noGrantText = await noGrant.text();
    expect(noGrant.status(), noGrantText).toBe(400);
    expect((JSON.parse(noGrantText) as { message: string }).message).toMatch(/read-write grant/i);

    const readOnly = await anita.post("/api/roadmap", { data: body({ sharing: "ORG", grants: [{ groupId, accessLevel: "RO" }] }) });
    expect(readOnly.status(), await readOnly.text()).toBe(400);

    const national = await anita.post("/api/roadmap", { data: body({ sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] }, "NATIONAL") });
    expect(national.status(), await national.text()).toBe(403);

    const id = await createRoadmap(anita, sandbox.orgId, { name: `Member ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      expect(await pageStatus(anita, `/roadmap/${id}`)).toBe(200);
      // Her grant lets her edit content; deleting the roadmap stays with the org's managers
      await putJson(anita, "/api/roadmap", update(id, { name: `Member renamed ${sandbox.label}` }));
      await deleteRoadmap(anita, id, 403);
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("grants must name groups of the owning org, once each", async ({ admin, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const duplicate = await admin.post("/api/roadmap", {
      data: { name: "x", description: "", orgId: sandbox.orgId, access: { sharing: "GROUPS", grants: [{ groupId, accessLevel: "RO" }, { groupId, accessLevel: "RW" }] } },
    });
    expect(duplicate.status(), await duplicate.text()).toBe(400);
    const foreign = await admin.post("/api/roadmap", {
      data: { name: "x", description: "", orgId: sandbox.orgId, access: { sharing: "GROUPS", grants: [{ groupId: "00000000-0000-0000-0000-000000000000", accessLevel: "RO" }] } },
    });
    expect(foreign.status(), await foreign.text()).toBe(400);
  });
});

test.describe("Sharing", () => {
  test("GROUPS → ORG → PUBLIC widens who may read; a grant reaches group members at every level", async ({ admin, anita, orgless, anon, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Shared ${sandbox.label}`, access: { sharing: "GROUPS", grants: [{ groupId, accessLevel: "RO" }] } });
    try {
      const iterationId = await createIteration(admin, id);
      const goalId = await createGoal(admin, iterationId, { name: `Goal ${sandbox.label}` });

      // GROUPS: only the granted group (anita) and the org's managers
      expect(await pageStatus(anita, `/roadmap/${id}`), "anita via RO grant").toBe(200);
      expect(await pageStatus(anita, `/goal/${goalId}`), "anita via RO grant, goal").toBe(200);
      expect(await pageStatus(orgless, `/roadmap/${id}`), "orgless under GROUPS").toBe(404);
      expect(await pageStatus(anon, `/roadmap/${id}`), "anonymous under GROUPS").toBe(404);
      // ...and read-only means read-only
      const readOnly = await anita.put("/api/roadmap", { data: update(id, { name: "nope" }) });
      expect(readOnly.status(), await readOnly.text()).toBe(403);

      // ORG: every non-guest member
      await putJson(admin, "/api/roadmap", update(id, { access: { sharing: "ORG", grants: [] } }));
      await expectPageStatus(anita, `/roadmap/${id}/v1`, 200); // anita as a member
      await expectPageStatus(orgless, `/roadmap/${id}`, 404); // orgless under ORG
      await expectPageStatus(anon, `/goal/${goalId}`, 404); // anonymous under ORG

      // PUBLIC: everyone
      await putJson(admin, "/api/roadmap", update(id, { access: { sharing: "PUBLIC", grants: [] } }));
      await expectPageStatus(orgless, `/roadmap/${id}`, 200); // orgless under PUBLIC
      await expectPageStatus(anon, `/roadmap/${id}/v1`, 200); // anonymous under PUBLIC
      await expectPageStatus(anon, `/goal/${goalId}`, 200); // anonymous under PUBLIC, goal

      // Back to GROUPS with no grant at all: members lose it too
      await putJson(admin, "/api/roadmap", update(id, { access: { sharing: "GROUPS", grants: [] } }));
      await expectPageStatus(anita, `/roadmap/${id}`, 404); // anita under GROUPS without a grant
      await expectPageStatus(admin, `/roadmap/${id}`, 200); // the manager always
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("PUBLIC is only honored for managers: a member asking for it gets ORG", async ({ admin, anita, anon, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const id = await createRoadmap(anita, sandbox.orgId, { name: `Wannabe public ${sandbox.label}`, access: { sharing: "PUBLIC", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      expect((await pageEntity(admin, `/roadmap/${id}`, id))?.access_control).toMatchObject({ sharing: "ORG" });
      expect(await pageStatus(anon, `/roadmap/${id}`)).toBe(404);
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });

  test("a read-write grant edits content but may not send `access`", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const id = await createRoadmap(admin, sandbox.orgId, { name: `RW ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } });
    try {
      await putJson(anita, "/api/roadmap", update(id, { name: `RW renamed ${sandbox.label}`, description: "by anita" }));
      await pageEntityWhen(admin, `/roadmap/${id}`, id, roadmap => roadmap?.name === `RW renamed ${sandbox.label}`);

      const sharing = await anita.put("/api/roadmap", { data: update(id, { access: { sharing: "PUBLIC", grants: [] } }) });
      expect(sharing.status(), await sharing.text()).toBe(403);
      const sameGrants = await anita.put("/api/roadmap", { data: update(id, { access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] } }) });
      expect(sameGrants.status(), `even unchanged settings: ${await sameGrants.text()}`).toBe(403);
      expect((await pageEntity(admin, `/roadmap/${id}`, id))?.access_control).toMatchObject({ sharing: "ORG" });
    }
    finally {
      await deleteRoadmap(admin, id);
    }
  });
});

test.describe("Update", () => {
  test("a stale timestamp answers 409 and a missing one 400", async ({ admin, sandbox }) => {
    const stale = await admin.put("/api/roadmap", { data: { id: sandbox.roadmapId, timestamp: Date.now() - 24 * 60 * 60 * 1000, name: "stale" } });
    const text = await stale.text();
    expect(stale.status(), text).toBe(409);
    expect((JSON.parse(text) as { message: string }).message).toMatch(/stale/i);

    const missing = await admin.put("/api/roadmap", { data: { id: sandbox.roadmapId, name: "no timestamp" } });
    expect(missing.status(), await missing.text()).toBe(400);

    expect((await pageEntity(admin, `/roadmap/${sandbox.roadmapId}`, sandbox.roadmapId))?.name).toBe(`Sandbox ${sandbox.label}`);
  });

  test("a view-only member gets 403, an unknown id 403, anonymous 401", async ({ admin, anita, anon, sandbox }) => {
    expect(await pageStatus(anita, `/roadmap/${sandbox.roadmapId}`), "anita reads the ORG-shared sandbox").toBe(200);
    const member = await anita.put("/api/roadmap", { data: update(sandbox.roadmapId, { name: "nope" }) });
    expect(member.status(), await member.text()).toBe(403);
    const unknown = await admin.put("/api/roadmap", { data: update("00000000-0000-0000-0000-000000000000", { name: "nope" }) });
    expect(unknown.status(), await unknown.text()).toBe(403);
    const anonymous = await anon.put("/api/roadmap", { data: update(sandbox.roadmapId, { name: "nope" }) });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
  });

  test("parentRoadmapId links a readable parent, null unlinks, a hidden parent is IllegalParent", async ({ admin, anita, sandbox }) => {
    const groupId = await groupIdByName(admin, sandbox.orgId, Seed.groupName);
    const hiddenId = await createRoadmap(admin, sandbox.orgId, { name: `Hidden parent ${sandbox.label}`, access: { sharing: "GROUPS", grants: [] } });
    const childId = await createRoadmap(admin, sandbox.orgId, { name: `Child ${sandbox.label}`, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] }, parentRoadmapId: sandbox.roadmapId });
    try {
      expect((await pageEntity(admin, `/roadmap/${childId}`, childId))?.parent_roadmap_id).toBe(sandbox.roadmapId);

      await putJson(anita, "/api/roadmap", update(childId, { parentRoadmapId: null }));
      await pageEntityWhen(admin, `/roadmap/${childId}`, childId, roadmap => roadmap?.parent_roadmap_id === null);

      const hidden = await anita.put("/api/roadmap", { data: update(childId, { parentRoadmapId: hiddenId }) });
      const text = await hidden.text();
      expect(hidden.status(), text).toBe(403);
      expect((JSON.parse(text) as { message: string }).message).toMatch(/parent/i);

      const createUnderHidden = await anita.post("/api/roadmap", {
        data: { name: "x", description: "", orgId: sandbox.orgId, access: { sharing: "ORG", grants: [{ groupId, accessLevel: "RW" }] }, parentRoadmapId: hiddenId },
      });
      expect(createUnderHidden.status(), await createUnderHidden.text()).toBe(403);

      // The manager may read the hidden roadmap, so for her it is a legal parent
      await putJson(admin, "/api/roadmap", update(childId, { parentRoadmapId: hiddenId }));
      await pageEntityWhen(admin, `/roadmap/${childId}`, childId, roadmap => roadmap?.parent_roadmap_id === hiddenId);
    }
    finally {
      await deleteRoadmap(admin, childId);
      await deleteRoadmap(admin, hiddenId);
    }
  });
});

test.describe("Delete", () => {
  test("DELETE removes the iterations, goals and actions with the roadmap", async ({ admin, sandbox }) => {
    const id = await createRoadmap(admin, sandbox.orgId, { name: `Doomed ${sandbox.label}` });
    const v1 = await createIteration(admin, id);
    const v2 = await createIteration(admin, id, { status: "DRAFT" });
    const goalId = await createGoal(admin, v1, { name: `Goal ${sandbox.label}` });
    const actionId = await createAction(admin, v2, { name: `Action ${sandbox.label}` });
    expect(await pageStatus(admin, `/roadmap/${id}/v2`)).toBe(200);

    const response = await admin.delete("/api/roadmap", { data: { id } });
    expect(response.status(), await response.text()).toBe(200);
    // The client follows Location to the owning org's landing page
    expect(response.headers()["location"]).toBe(`/?org=${sandbox.orgId}`);

    await expectPageStatus(admin, `/roadmap/${id}`, 404);
    await expectPageStatus(admin, `/roadmap/${id}/v1`, 404);
    await expectPageStatus(admin, `/roadmap/${id}/v2`, 404);
    await expectPageStatus(admin, `/roadmap/${id}/latest`, 404);
    await expectPageStatus(admin, `/goal/${goalId}`, 404);
    await expectPageStatus(admin, `/action/${actionId}`, 404);
    await deleteRoadmap(admin, id, 403);
  });

  test("DELETE is for managers only; a bad body is 400", async ({ admin, anita, anon, sandbox }) => {
    await deleteRoadmap(anita, sandbox.roadmapId, 403);
    const anonymous = await anon.delete("/api/roadmap", { data: { id: sandbox.roadmapId } });
    expect(anonymous.status(), await anonymous.text()).toBe(401);
    const missing = await admin.delete("/api/roadmap", { data: {} });
    expect(missing.status(), await missing.text()).toBe(400);
    expect(await pageStatus(admin, `/roadmap/${sandbox.roadmapId}`)).toBe(200);
  });
});
