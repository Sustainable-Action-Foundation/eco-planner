import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/users";
import { createAction, createGoal, deleteGoal, pageEntityWhen, Seed } from "../lib/api";
import { MaxAttachmentBytes, MaxAttachmentsPerObject } from "../../src/functions/attachments";

/*
 * Contract of /api/attachment: documents on versions, goals and actions, kept in the
 * bucket and listed by the object pages. Attaching (POST, multipart) and removing
 * (DELETE) take edit access on the object; downloading (GET /api/attachment/[id])
 * takes view access and redirects to a short-lived link the request follows. The
 * stack under test has a bucket (see the s3 service in docker/compose.testing.yaml).
 */

// Page read-backs poll for the fresh render on a shared, loaded dev server; give them room
test.slow(true, "read-after-write polling against the shared dev server");

const NIL = "00000000-0000-0000-0000-000000000000";

type PageAttachment = { id: string, name: string, size: number, content_type: string, author: { username: string } | null };

/** Sends `content` as a file named `name` to the object; the API takes the type from the name, not the part */
function upload(request: APIRequestContext, objectId: string, name: string, content: string | Buffer) {
  return request.post("/api/attachment", { multipart: { objectId, file: { name, mimeType: "application/octet-stream", buffer: Buffer.from(content) } } });
}

/** Uploads and resolves with the new attachment's id */
async function uploaded(request: APIRequestContext, objectId: string, name: string, content: string | Buffer): Promise<string> {
  const response = await upload(request, objectId, name, content);
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as { id: string }).id;
}

/** The attachments a page delivers for an entity once `ready` holds for them (the pages are cached until the write expires them) */
async function renderedAttachments(request: APIRequestContext, url: string, id: string, ready: (list: PageAttachment[]) => boolean): Promise<PageAttachment[]> {
  const listOf = (entity: Record<string, unknown> | null) => (entity?.attachments as PageAttachment[] | undefined) ?? [];
  const entity = await pageEntityWhen(request, url, id, entity => ready(listOf(entity)), `${url} to list the attachments`);
  return listOf(entity);
}

test("a document on a goal is listed with its author, downloads unchanged and can be removed by an editor", async ({ admin, anita, anon, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Documented ${sandbox.label}` });
  const name = "Åtgärdsrapport 2026.txt";
  const content = `rapport ${sandbox.label}`;
  const id = await uploaded(admin, goalId, name, content);

  const [listed] = await renderedAttachments(admin, `/goal/${goalId}`, goalId, list => list.length === 1);
  expect(listed).toMatchObject({ id, name, size: Buffer.byteLength(content), content_type: "text/plain" });
  // Usernames are stored as registered; login is case-insensitive
  expect(listed.author?.username.toLowerCase()).toBe(Seed.admin.username);

  // Anita may view the ORG-shared sandbox: the download redirects to the file, served as an attachment under its name
  const download = await anita.get(`/api/attachment/${id}`);
  expect(download.status(), await download.text()).toBe(200);
  expect(await download.text()).toBe(content);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(download.headers()["content-disposition"]).toContain(encodeURIComponent(name));
  // She may not edit the goal, so she cannot remove the document; anonymous visitors cannot even see it
  expect((await anita.delete("/api/attachment", { data: { id } })).status()).toBe(404);
  expect((await anon.get(`/api/attachment/${id}`)).status()).toBe(404);

  const removed = await admin.delete("/api/attachment", { data: { id } });
  expect(removed.status(), await removed.text()).toBe(200);
  expect((await admin.get(`/api/attachment/${id}`)).status()).toBe(404);
  expect(await renderedAttachments(admin, `/goal/${goalId}`, goalId, list => list.length === 0)).toEqual([]);
});

test("versions and actions take documents too; the roadmap itself does not", async ({ admin, sandbox }) => {
  const actionId = await createAction(admin, sandbox.iterationId, { name: `Action ${sandbox.label}` });
  const versionDocument = await uploaded(admin, sandbox.iterationId, "version.txt", "v");
  const actionDocument = await uploaded(admin, actionId, "action.txt", "a");

  expect((await renderedAttachments(admin, `/roadmap/${sandbox.roadmapId}/v1`, sandbox.iterationId, list => list.length === 1)).map(a => a.id)).toEqual([versionDocument]);
  expect((await renderedAttachments(admin, `/action/${actionId}`, actionId, list => list.length === 1)).map(a => a.id)).toEqual([actionDocument]);

  // The roadmap page is a menu, not a place for documents: answered like an unknown object
  const roadmap = await upload(admin, sandbox.roadmapId, "roadmap.txt", "r");
  expect(roadmap.status(), await roadmap.text()).toBe(404);
});

test("anonymous 401; no file 400; disallowed type 415; oversize 413; unknown object or no edit access 404", async ({ admin, anita, orgless, anon, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Guarded ${sandbox.label}` });

  expect((await upload(anon, goalId, "a.txt", "a")).status()).toBe(401);

  const noFile = await admin.post("/api/attachment", { multipart: { objectId: goalId } });
  expect(noFile.status(), await noFile.text()).toBe(400);
  expect((await upload(admin, goalId, "setup.exe", "MZ")).status()).toBe(415);
  expect((await upload(admin, goalId, "index.html", "<p>")).status()).toBe(415);
  // One byte over the cap, refused on the declared length before the body is read
  expect((await upload(admin, goalId, "big.txt", Buffer.alloc(MaxAttachmentBytes + 1, 97))).status()).toBe(413);

  expect((await upload(admin, NIL, "a.txt", "a")).status()).toBe(404);
  // Anita only views the sandbox; the orgless user doesn't even see it. Both get the same answer as for an unknown id
  expect((await upload(anita, goalId, "a.txt", "a")).status()).toBe(404);
  expect((await upload(orgless, goalId, "a.txt", "a")).status()).toBe(404);

  expect(await renderedAttachments(admin, `/goal/${goalId}`, goalId, () => true)).toEqual([]);
});

test("an object takes at most MaxAttachmentsPerObject documents", async ({ admin, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Full ${sandbox.label}` });
  for (let i = 0; i < MaxAttachmentsPerObject; i++) {
    await uploaded(admin, goalId, `document-${i}.txt`, `${i}`);
  }
  const extra = await upload(admin, goalId, "one-too-many.txt", "x");
  expect(extra.status(), await extra.text()).toBe(409);
  expect((await renderedAttachments(admin, `/goal/${goalId}`, goalId, list => list.length === MaxAttachmentsPerObject)).length).toBe(MaxAttachmentsPerObject);
});

test("deleting the object takes its documents with it", async ({ admin, sandbox }) => {
  const goalId = await createGoal(admin, sandbox.iterationId, { name: `Doomed ${sandbox.label}` });
  const id = await uploaded(admin, goalId, "gone.txt", "gone");
  expect((await admin.get(`/api/attachment/${id}`)).status()).toBe(200);

  await deleteGoal(admin, goalId);
  expect((await admin.get(`/api/attachment/${id}`)).status()).toBe(404);
});
