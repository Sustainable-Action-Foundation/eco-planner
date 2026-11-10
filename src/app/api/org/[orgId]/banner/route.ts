import { getAccessContextFor, getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { MaxOrgBannerBytes, orgBannerPath, orgBannerStorageKey, OrgBannerRejection, rejectOrgBanner } from "@/functions/orgBanner";
import { managesOrg, seesOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { deleteStoredObjects, getStoredObject, isObjectStorageConfigured, putStoredObject } from "@/lib/objectStorage";
import { transcodeOrgBanner } from "@/lib/orgBannerImage";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/*
 * An org's landing banner: one image per org in the bucket, re-encoded as WebP on
 * upload. Managers (and super admins) set and remove it; everyone who sees the org's
 * landing page may fetch it. The org row only carries the upload time, which doubles
 * as the "has a banner" flag and the cache-busting version in the image URL.
 */

type Context = { params: Promise<{ orgId: string }> };

/** Uploads per user: a burst of 5, then about one a minute. The test stack uploads far more than a person would. */
const uploadRate = process.env.TEST_ENVIRONMENT === "testing"
  ? { capacity: 1000, refillPerSecond: 10 }
  : { capacity: 5, refillPerSecond: 1 / 60 };

/** A year: a versioned banner URL never changes its content */
const immutableFor = 365 * 24 * 60 * 60;

/** The session's access context, or null for anonymous and stale sessions (which get logged out). */
async function requireUser(session: Awaited<ReturnType<typeof getSession>>): Promise<UserAccessContext | null> {
  if (!session.user?.isLoggedIn || !session.user.id) return null;
  const accessContext = await getAccessContextFor(session.user);
  if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
    session.destroy();
    return null;
  }
  return accessContext;
}

/**
 * The banner itself. Served by the app rather than through a presigned link so the
 * browser can cache it: the current version is immutable under its `?v=`, any other
 * `v` (or none) is revalidated every time. Private, since it takes a membership.
 */
export async function GET(request: NextRequest, context: Context) {
  const [{ orgId }, accessContext, t] = await Promise.all([
    context.params,
    getUserAccessContext(),
    serveTea("api"),
  ]);

  // Strangers get the same answer as for an unknown org
  if (!seesOrg(accessContext, orgId)) {
    return Response.json({ message: t("api:org.not_found") },
      { status: 404 },
    );
  }

  let org: { banner_updated_at: Date | null } | null;
  try {
    org = await prisma.orgs.findUnique({ where: { id: orgId }, select: { banner_updated_at: true } });
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }
  if (!org) {
    return Response.json({ message: t("api:org.not_found") },
      { status: 404 },
    );
  }
  if (!org.banner_updated_at) {
    return Response.json({ message: t("api:org.banner_none") },
      { status: 404 },
    );
  }

  if (!isObjectStorageConfigured()) {
    return Response.json({ message: t("api:attachment.storage_unavailable") },
      { status: 503 },
    );
  }

  try {
    const stored = await getStoredObject(orgBannerStorageKey(orgId));
    if (!stored) {
      // Removed from the bucket behind the app's back; a manager can clear the setting
      return Response.json({ message: t("api:org.banner_missing") },
        { status: 404 },
      );
    }

    const current = String(org.banner_updated_at.getTime());
    const headers = new Headers({
      "Content-Type": "image/webp",
      "Cache-Control": request.nextUrl.searchParams.get("v") === current
        ? `private, max-age=${immutableFor}, immutable`
        : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    if (stored.contentLength !== null) headers.set("Content-Length", String(stored.contentLength));
    if (stored.etag) headers.set("ETag", stored.etag);
    headers.set("Last-Modified", (stored.lastModified ?? org.banner_updated_at).toUTCString());
    return new Response(stored.body, { status: 200, headers });
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }
}

/**
 * Sets the banner from a multipart `file`. Any decodable image goes: it is fitted to
 * the size cap, stripped of metadata and stored as WebP, replacing the previous one.
 */
export async function POST(request: NextRequest, context: Context) {
  const [{ orgId }, session, t] = await Promise.all([
    context.params,
    getSession(await cookies()),
    serveTea("api"),
  ]);

  const accessContext = await requireUser(session);
  if (!accessContext) {
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!consumeToken(`org-banner:${accessContext.id}`, uploadRate)) {
    return Response.json({ message: t("api:attachment.rate_limited") },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: t("api:common.invalid_request_body") },
      { status: 400 },
    );
  }

  const rejection = rejectOrgBanner(file);
  if (rejection === OrgBannerRejection.TooLarge) {
    return Response.json({ message: t("api:org.banner_too_large", { maxSize: Math.round(MaxOrgBannerBytes / 1e6) }) },
      { status: 413 },
    );
  }
  if (rejection !== null) {
    return Response.json({ message: t("api:org.banner_type_not_allowed") },
      { status: 415 },
    );
  }

  try {
    const org = await prisma.orgs.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org || !managesOrg(accessContext, org.id)) {
      // A 404 for existing-but-unmanaged orgs too, to not leak their existence
      return Response.json({ message: t("api:org.not_found") },
        { status: 404 },
      );
    }

    // The extension only gates the input; the bytes decide, and a file that isn't an image is told so
    const image = await transcodeOrgBanner(new Uint8Array(await file.arrayBuffer()));
    if (!image) {
      return Response.json({ message: t("api:org.banner_unreadable") },
        { status: 400 },
      );
    }

    // Checked last, so every other refusal behaves the same with or without a bucket
    if (!isObjectStorageConfigured()) {
      return Response.json({ message: t("api:attachment.storage_unavailable") },
        { status: 503 },
      );
    }

    await putStoredObject(orgBannerStorageKey(org.id), image.data, "image/webp");
    const updated = await prisma.orgs.update({
      where: { id: org.id },
      data: { banner_updated_at: new Date() },
      select: { banner_updated_at: true },
    });

    // The landing page caches the org (with its banner version) under the 'org' tag
    revalidateTag('org', { expire: 0 });
    return Response.json({
      message: t("api:org.banner_uploaded"),
      url: orgBannerPath(org.id, updated.banner_updated_at ?? new Date()),
      width: image.width,
      height: image.height,
    }, { status: 200 });
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:attachment.upload_failed") },
      { status: 500 },
    );
  }
}

/** Removes the banner: the setting first, then the object (best effort), so the page never points at a missing file. */
export async function DELETE(_request: NextRequest, context: Context) {
  const [{ orgId }, session, t] = await Promise.all([
    context.params,
    getSession(await cookies()),
    serveTea("api"),
  ]);

  const accessContext = await requireUser(session);
  if (!accessContext) {
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  try {
    const org = await prisma.orgs.findUnique({ where: { id: orgId }, select: { id: true, banner_updated_at: true } });
    if (!org || !managesOrg(accessContext, org.id)) {
      return Response.json({ message: t("api:org.not_found") },
        { status: 404 },
      );
    }
    if (!org.banner_updated_at) {
      return Response.json({ message: t("api:org.banner_none") },
        { status: 404 },
      );
    }

    await prisma.orgs.update({ where: { id: org.id }, data: { banner_updated_at: null } });
    await deleteStoredObjects([orgBannerStorageKey(org.id)]);

    revalidateTag('org', { expire: 0 });
    return Response.json({ message: t("api:org.banner_removed") },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }
}
