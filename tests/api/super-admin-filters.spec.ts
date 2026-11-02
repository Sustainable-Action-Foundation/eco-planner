import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";
import { createAction, createGoal, createIteration, createRoadmap, deleteRoadmap, flightPayload, orgIdByName, pageEntity, putJson, requestAs } from "../lib/api";
import { memberSlug } from "../../scripts/prisma/seed/places";

/*
 * Super admins see and edit everything, also in orgs they are no member of. Their rung
 * of the access ladder used to be the empty clause `{}`, which Prisma drops when it is
 * a branch of an OR (`OR: [{ hidden: false }, { access_control: {} }]` becomes
 * `hidden: false`): the show-hidden toggle and the attachment removal lost the super
 * admin. Lars manages Kiruna kommun (admin has no membership there) and sets up the
 * content; the super admin must find it everywhere an editor does.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const KIRUNA = "Kiruna kommun";

/** Whether the landing at `url` lists the roadmap (its first version is linked from the tree) */
async function listsRoadmap(request: APIRequestContext, url: string, roadmapId: string): Promise<boolean> {
  return (await flightPayload(request, url)).includes(`/roadmap/${roadmapId}/v1`);
}

/** The like count the landing at `url` shows for the goal, or null when the goal is not in the liked list */
async function landingLikeCount(request: APIRequestContext, url: string, goalId: string): Promise<number | null> {
  const match = (await flightPayload(request, url)).match(new RegExp(`"goalId":"${goalId}","liked":(?:true|false),"likeCount":(\\d+)`));
  return match ? Number(match[1]) : null;
}

test.describe("Super admin in a foreign org", () => {
  test("drafts, unlisted goals and hidden roadmaps of an org the super admin is no member of reach them like an editor", async ({ admin, orgless, playwright, baseURL }, testInfo) => {
    const label = `${testInfo.project.name} ${testInfo.retry} ${Date.now().toString(36)}`;
    const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia"));
    const kirunaId = await orgIdByName(lars, KIRUNA);
    const roadmapId = await createRoadmap(lars, kirunaId, { name: `Foreign ${label}`, access: { sharing: "ORG", grants: [] } });
    const hiddenId = await createRoadmap(lars, kirunaId, { name: `Foreign hidden ${label}`, access: { sharing: "ORG", grants: [] } });
    try {
      const publishedId = await createIteration(lars, roadmapId);
      const draftId = await createIteration(lars, roadmapId, { status: "DRAFT" });
      const unlistedId = await createGoal(lars, publishedId, { name: `Unlisted ${label}`, listing: "UNLISTED" });
      await createIteration(lars, hiddenId);
      await putJson(lars, "/api/roadmap", { id: hiddenId, timestamp: Date.now(), hidden: true });
      const liked = await lars.post("/api/goal-like", { data: { goalId: unlistedId } });
      expect(liked.status(), await liked.text()).toBe(200);

      // The draft is offered as a target in the version pickers (edit access only)
      expect(await pageEntity(lars, "/action/create", draftId), "the manager picks the draft").not.toBeNull();
      expect(await pageEntity(orgless, "/action/create", draftId), "an outsider does not").toBeNull();
      expect(await pageEntity(admin, "/action/create", draftId), "the super admin picks the draft").not.toBeNull();

      // The unlisted goal ranks in the landing's liked list for editors only
      const landing = `/?org=${kirunaId}`;
      await expect.poll(() => landingLikeCount(lars, landing, unlistedId), { message: "the manager's landing lists the liked unlisted goal", timeout: 60_000 }).toBe(1);
      await expect.poll(() => landingLikeCount(admin, landing, unlistedId), { message: "the super admin's landing lists the liked unlisted goal", timeout: 60_000 }).toBe(1);

      // The hidden roadmap is off the landing and back with "show hidden" (writable ones only)
      await expect.poll(() => listsRoadmap(admin, landing, hiddenId), { message: "hidden roadmaps leave the landing", timeout: 60_000 }).toBe(false);
      await expect.poll(() => listsRoadmap(lars, `${landing}&showHidden=true`, hiddenId), { message: "show hidden brings it back for the manager", timeout: 60_000 }).toBe(true);
      await expect.poll(() => listsRoadmap(admin, `${landing}&showHidden=true`, hiddenId), { message: "show hidden brings it back for the super admin", timeout: 60_000 }).toBe(true);
    }
    finally {
      await Promise.all([deleteRoadmap(lars, roadmapId), deleteRoadmap(lars, hiddenId)]);
      await lars.dispose();
    }
  });

  test("the super admin removes a document from an action of the foreign org", async ({ admin, anita, playwright, baseURL }, testInfo) => {
    const label = `${testInfo.project.name} ${testInfo.retry} ${Date.now().toString(36)}`;
    const lars = await requestAs(playwright, baseURL, memberSlug("Lars Niia"));
    const kirunaId = await orgIdByName(lars, KIRUNA);
    const roadmapId = await createRoadmap(lars, kirunaId, { name: `Foreign documents ${label}`, access: { sharing: "ORG", grants: [] } });
    try {
      const iterationId = await createIteration(lars, roadmapId);
      const actionId = await createAction(lars, iterationId, { name: `Documented ${label}` });
      const goalId = await createGoal(lars, iterationId, { name: `Documented ${label}` });
      const ids: string[] = [];
      for (const objectId of [actionId, goalId, iterationId]) {
        const uploaded = await lars.post("/api/attachment", { multipart: { objectId, file: { name: "note.txt", mimeType: "application/octet-stream", buffer: Buffer.from("n") } } });
        expect(uploaded.status(), await uploaded.text()).toBe(200);
        ids.push(((await uploaded.json()) as { id: string }).id);
      }

      for (const id of ids) {
        // Anita is no member of Kiruna: for her the document does not exist
        expect((await anita.delete("/api/attachment", { data: { id } })).status()).toBe(404);
        const removed = await admin.delete("/api/attachment", { data: { id } });
        expect(removed.status(), `super admin removes ${id}: ${await removed.text()}`).toBe(200);
      }
    }
    finally {
      await deleteRoadmap(lars, roadmapId);
      await lars.dispose();
    }
  });
});
