import { expect, test } from "../lib/users";
import { createAction, createComment, createGoal, pageEntity, Seed } from "../lib/api";
import { commentSorter } from "../../src/lib/sorters";

/*
 * Contract of /api/comment: only POST exists (the route has no edit or delete
 * handlers). A signed-in user with view access may
 * comment on a goal, roadmap, iteration or action; the pages deliver the
 * comments with their authors, and `commentSorter` puts the newest first.
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const NIL = "00000000-0000-0000-0000-000000000000";

type PageComment = { id: string, comment_text: string, created_at: string, author: { username: string } | null };

/** The comments a page delivers for an entity, in the order the component renders them */
async function renderedComments(request: Parameters<typeof pageEntity>[0], url: string, id: string): Promise<PageComment[]> {
  const entity = await pageEntity(request, url, id);
  const comments = (entity?.comments as PageComment[] ?? []).map(comment => ({ ...comment, created_at: comment.created_at.replace(/^\$D/, "") }));
  return comments.sort(commentSorter);
}

test("comments on a goal are delivered with their authors, newest first", async ({ admin, anita, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Commented ${sandbox.label}` });
  const firstId = await createComment(admin, goalId, `first ${sandbox.label}`);
  const secondId = await createComment(anita, goalId, `second ${sandbox.label}`);

  const comments = await renderedComments(anita, `/goal/${goalId}`, goalId);
  expect(comments.map(comment => comment.id)).toEqual([secondId, firstId]);
  expect(comments.map(comment => comment.comment_text)).toEqual([`second ${sandbox.label}`, `first ${sandbox.label}`]);
  // Usernames are stored as registered ("Anita"); login is case-insensitive
  expect(comments.map(comment => comment.author?.username.toLowerCase())).toEqual([Seed.anita.username, Seed.admin.username]);
  expect(new Date(comments[0].created_at).getTime()).toBeGreaterThanOrEqual(new Date(comments[1].created_at).getTime());
});

test("roadmaps, iterations and actions take comments too", async ({ admin, sandbox }) => {
  const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
  const roadmapCommentId = await createComment(admin, sandbox.roadmapId, `roadmap ${sandbox.label}`);
  const iterationCommentId = await createComment(admin, sandbox.iterationId, `iteration ${sandbox.label}`);
  const actionCommentId = await createComment(admin, actionId, `action ${sandbox.label}`);

  expect((await renderedComments(admin, `/roadmap/${sandbox.roadmapId}`, sandbox.roadmapId)).map(comment => comment.id)).toEqual([roadmapCommentId]);
  expect((await renderedComments(admin, `/roadmap/${sandbox.roadmapId}/v1`, sandbox.iterationId)).map(comment => comment.id)).toEqual([iterationCommentId]);
  expect((await renderedComments(admin, `/action/${actionId}`, actionId)).map(comment => comment.id)).toEqual([actionCommentId]);
});

test("empty text, an unknown object and a bad body answer 400; anonymous 401; no view access 403", async ({ admin, orgless, anon, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Guarded ${sandbox.label}` });

  const empty = await admin.post("/api/comment", { data: { commentText: "", objectId: goalId } });
  expect(empty.status(), await empty.text()).toBe(400);
  const unknown = await admin.post("/api/comment", { data: { commentText: "hello", objectId: NIL } });
  expect(unknown.status(), await unknown.text()).toBe(400);
  const bad = await admin.post("/api/comment", { data: { objectId: goalId } });
  expect(bad.status(), await bad.text()).toBe(400);

  const anonymous = await anon.post("/api/comment", { data: { commentText: "hello", objectId: goalId } });
  expect(anonymous.status(), await anonymous.text()).toBe(401);
  // The sandbox is ORG-shared: an orgless user cannot see the goal, so cannot comment on it
  const outsider = await orgless.post("/api/comment", { data: { commentText: "hello", objectId: goalId } });
  expect(outsider.status(), await outsider.text()).toBe(403);
  const outsiderRoadmap = await orgless.post("/api/comment", { data: { commentText: "hello", objectId: sandbox.roadmapId } });
  expect(outsiderRoadmap.status(), await outsiderRoadmap.text()).toBe(403);

  expect(await renderedComments(admin, `/goal/${goalId}`, goalId)).toEqual([]);
});

test("there is no edit or delete: PUT and DELETE are not handled", async ({ admin, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Permanent ${sandbox.label}` });
  const id = await createComment(admin, goalId, `permanent ${sandbox.label}`);
  const deleted = await admin.delete("/api/comment", { data: { id } });
  expect(deleted.status(), await deleted.text()).toBe(405);
  const edited = await admin.put("/api/comment", { data: { id, commentText: "edited" } });
  expect(edited.status(), await edited.text()).toBe(405);
  expect((await renderedComments(admin, `/goal/${goalId}`, goalId)).map(comment => comment.id)).toEqual([id]);
});
