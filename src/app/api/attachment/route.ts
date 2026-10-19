import findTypeFromId from "@/functions/findTypeFromId";
import { attachmentContentType, AttachmentRejection, MaxAttachmentBytes, MaxAttachmentsPerObject, rejectAttachment, sanitizeAttachmentName } from "@/functions/attachments";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { editableActionsWHERE, editableAttachmentsWHERE, writableAccessControlWHERE } from "@/lib/accessFilters";
import { isAttachmentParent, type AttachmentParent } from "@/lib/attachments";
import serveTea from "@/lib/i18nServer";
import { deleteStoredObjects, isObjectStorageConfigured, putStoredObject } from "@/lib/objectStorage";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import type { JSONValue, UserAccessContext } from "@/types";
import { isStandardObject } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

/*
 * Documents attached to a version, goal or action. The file goes to the
 * bucket, the row to the database. Attaching and removing are content edits, so
 * they take the same edit access as editing the object itself.
 *
 * Guards against abuse: signed-in editors only, a size cap, a type allowlist, a
 * per-object file count, and a per-user upload rate (in-memory, single instance
 * like the external API proxies).
 */

/** Uploads per user: a burst of 10, then about 3 a minute. The test stack uploads far more than a person would. */
const uploadRate = process.env.TEST_ENVIRONMENT === "testing"
  ? { capacity: 1000, refillPerSecond: 10 }
  : { capacity: 10, refillPerSecond: 3 / 60 };

/** True when the user may attach to and detach from the object. */
async function mayEditParent(parent: AttachmentParent, id: string, ctx: UserAccessContext): Promise<boolean> {
  const writableIteration = { roadmap: { access_control: writableAccessControlWHERE(ctx) } };
  switch (parent) {
    case "action":
      return !!await prisma.actions.findUnique({ where: { id, AND: [editableActionsWHERE(ctx)] }, select: { id: true } });
    case "goal":
      return !!await prisma.goals.findUnique({ where: { id, roadmap_iteration: writableIteration }, select: { id: true } });
    case "roadmapIteration":
      return !!await prisma.roadmapIterations.findUnique({ where: { id, ...writableIteration }, select: { id: true } });
    default:
      // The union is covered above; anything else can't be edited
      return false;
  }
}

/** The session's access context, or null for anonymous and stale sessions (which get logged out). */
async function requireUser(session: Awaited<ReturnType<typeof getSession>>): Promise<UserAccessContext | null> {
  if (!session.user?.isLoggedIn || !session.user.id) return null;
  const accessContext = await getAccessContextById(session.user.id);
  if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
    session.destroy();
    return null;
  }
  return accessContext;
}

/**
 * Attaches a file: multipart form data with `objectId` (the roadmap, version, goal or
 * action) and `file`.
 */
export async function POST(request: NextRequest) {
  const [session, t] = await Promise.all([
    getSession(await cookies()),
    serveTea("api"),
  ]);

  const accessContext = await requireUser(session);
  if (!accessContext) {
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Refuse oversized uploads before buffering the body; the multipart framing adds a little on top of the file
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MaxAttachmentBytes + 64 * 1024) {
    return Response.json({ message: t("api:attachment.too_large", { maxSize: Math.round(MaxAttachmentBytes / 1e6) }) },
      { status: 413 },
    );
  }

  if (!consumeToken(`attachment:${accessContext.id}`, uploadRate)) {
    return Response.json({ message: t("api:attachment.rate_limited") },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const form = await request.formData().catch(() => null);
  const objectId = form?.get("objectId");
  const file = form?.get("file");
  if (!form || typeof objectId !== "string" || !objectId || !(file instanceof File)) {
    return Response.json({ message: t("api:common.invalid_request_body") },
      { status: 400 },
    );
  }

  const rejection = rejectAttachment(file);
  if (rejection === AttachmentRejection.TooLarge) {
    return Response.json({ message: t("api:attachment.too_large", { maxSize: Math.round(MaxAttachmentBytes / 1e6) }) },
      { status: 413 },
    );
  }
  if (rejection !== null) {
    return Response.json({ message: t("api:attachment.type_not_allowed") },
      { status: 415 },
    );
  }

  // A roadmap id is answered like an unknown one: its page carries no documents
  const parent = await findTypeFromId(objectId);
  if (!parent || !isAttachmentParent(parent) || !await mayEditParent(parent, objectId, accessContext)) {
    // The object doesn't exist, or the user can't edit it; the same answer for both
    return Response.json({ message: t("api:attachment.not_found") },
      { status: 404 },
    );
  }

  const name = sanitizeAttachmentName(file.name);
  const contentType = attachmentContentType(name) ?? "application/octet-stream";
  const id = randomUUID();
  // Grouped by parent in the bucket so an admin browsing it can tell what belongs where; keys are UTF-8, the SDK encodes them
  const storageKey = `attachments/${parent}/${objectId}/${id}/${name}`;
  const parentColumn = {
    action_id: parent === "action" ? objectId : null,
    goal_id: parent === "goal" ? objectId : null,
    roadmap_iteration_id: parent === "roadmapIteration" ? objectId : null,
  };

  try {
    const count = await prisma.attachments.count({ where: parentColumn });
    if (count >= MaxAttachmentsPerObject) {
      return Response.json({ message: t("api:attachment.too_many", { max: MaxAttachmentsPerObject }) },
        { status: 409 },
      );
    }

    // Checked last, so every other refusal behaves the same with or without a bucket
    if (!isObjectStorageConfigured()) {
      return Response.json({ message: t("api:attachment.storage_unavailable") },
        { status: 503 },
      );
    }

    await putStoredObject(storageKey, new Uint8Array(await file.arrayBuffer()), contentType);
    try {
      await prisma.attachments.create({
        data: { id, name, storage_key: storageKey, size: file.size, content_type: contentType, author_id: accessContext.id, ...parentColumn },
      });
    } catch (error) {
      // No row, no file: don't leave an unreachable object behind
      await deleteStoredObjects([storageKey]);
      throw error;
    }

    // Expire immediately so the uploader sees the file on refresh
    revalidateTag(parent, { expire: 0 });
    return Response.json({ message: t("api:attachment.uploaded", { name }), id, name },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:attachment.upload_failed") },
      { status: 500 },
    );
  }
}

/** Removes an attachment: `{ id }`. Takes edit access to the object it hangs off. */
export async function DELETE(request: NextRequest) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    (request.json() as Promise<JSONValue>).catch(() => null),
    serveTea("api"),
  ]);

  const accessContext = await requireUser(session);
  if (!accessContext) {
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!isStandardObject(body) || Array.isArray(body) || typeof body.id !== "string" || !body.id) {
    return Response.json({ message: t("api:common.invalid_request_body") },
      { status: 400 },
    );
  }

  try {
    // Found only if the user may edit whichever object it hangs off
    const attachment = await prisma.attachments.findFirst({
      where: { id: body.id, AND: [editableAttachmentsWHERE(accessContext)] },
      select: { id: true, storage_key: true, action_id: true, goal_id: true, roadmap_iteration_id: true },
    });
    if (!attachment) {
      return Response.json({ message: t("api:attachment.not_found") },
        { status: 404 },
      );
    }

    await prisma.attachments.delete({ where: { id: attachment.id } });
    await deleteStoredObjects([attachment.storage_key]);

    const parent: AttachmentParent = attachment.action_id ? "action" : attachment.goal_id ? "goal" : "roadmapIteration";
    revalidateTag(parent, { expire: 0 });
    return Response.json({ message: t("api:attachment.deleted") },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }
}
