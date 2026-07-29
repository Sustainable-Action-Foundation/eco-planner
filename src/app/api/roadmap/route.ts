import type { NextRequest } from "next/server";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { accessControlSelection } from "@/fetchers/inclusionSelectors";
import pruneOrphans from "@/functions/pruneOrphans";
import accessChecker, { hasAdminAccess, hasEditAccess, hasViewAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { AccessLevel as GrantLevel, OrgRole, RoadmapType } from "@/lib/prisma/generated";
import { Prisma } from "../../../../prisma/generated/client";
import { getSession } from "@/lib/session";
import type { AccessControlInput, UserAccessContext, JSONValue } from "@/types";
import { ClientError } from "@/types/enums";
import { isRoadmapCreate, isRoadmapUpdate } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";

/**
 * Validates sharing settings against the owning org and builds the values to store.
 * Returns null (plus a message) when the input is invalid.
 *
 * `isPublic` is only honored for users with admin access to the org's content
 * (org managers and super admins); for everyone else it stays false.
 */
async function resolveAccessInput(
  access: AccessControlInput | undefined,
  orgId: string,
  accessContext: UserAccessContext,
  creatorMustKeepEditAccess: boolean,
): Promise<{ ok: true, isPublic: boolean, orgReadable: boolean, grants: { group_id: string, access_level: GrantLevel }[] } | { ok: false, message: string }> {
  const isOrgAdmin = accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);

  const isPublic = (access?.isPublic ?? false) && isOrgAdmin;
  const orgReadable = access?.orgReadable ?? true;
  const grants = (access?.grants ?? []).map(grant => ({ group_id: grant.groupId, access_level: grant.accessLevel }));

  // Every granted group must belong to the owning org (the composite FK would also
  // reject this at insert, but check upfront for a clear error message)
  const groupIds = [...new Set(grants.map(grant => grant.group_id))];
  if (groupIds.length !== grants.length) {
    return { ok: false, message: 'Duplicate groups in grants' };
  }
  if (groupIds.length > 0) {
    const matching = await prisma.groups.count({ where: { id: { in: groupIds }, org_id: orgId } });
    if (matching !== groupIds.length) {
      return { ok: false, message: 'All granted groups must belong to the owning org' };
    }
  }

  // A non-manager creator must keep edit access to their own creation via an RW grant
  if (creatorMustKeepEditAccess && !isOrgAdmin) {
    const userGroupIds = new Set(accessContext.memberships.flatMap(membership => membership.groupIds));
    const keepsEditAccess = grants.some(grant => grant.access_level === GrantLevel.RW && userGroupIds.has(grant.group_id));
    if (!keepsEditAccess) {
      return { ok: false, message: 'Sharing settings must include a read-write grant for a group you belong to, so you can keep editing the roadmap' };
    }
  }

  return { ok: true, isPublic, orgReadable, grants };
}

/**
 * Handles POST requests to the roadmap API (the top level owning access control and iterations)
 */
export async function POST(request: NextRequest) {
  const [session, roadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate request body
  if (!isRoadmapCreate(roadmap)) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  // If given roadmap type is invalid or undefined, set it to OTHER
  roadmap.type ??= RoadmapType.OTHER;
  if (!(roadmap.type in RoadmapType)) {
    roadmap.type = RoadmapType.OTHER;
  }

  let accessContext: UserAccessContext;
  try {
    const [fetchedContext, targetRoadmap] = await Promise.all([
      getAccessContextById(session.user.id),
      ...(
        roadmap.parentRoadmapId ?
          [
            prisma.roadmaps.findUnique({
              where: { id: roadmap.parentRoadmapId },
              select: { access_control: { select: accessControlSelection } },
            }),
          ] :
          []
      ),
    ]);
    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!fetchedContext || (session.user.isSuperAdmin && !fetchedContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap' });
    }
    accessContext = fetchedContext;

    // The user must be a non-guest member of the org that will own the roadmap (super admins are exempt)
    const membership = accessContext.memberships.find(m => m.orgId === roadmap.orgId);
    if (!accessContext.isSuperAdmin && (!membership || membership.role === OrgRole.GUEST)) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap' });
    }

    // Get the target roadmap (if any) to check if the user has access to it
    if (roadmap.parentRoadmapId) {
      // For now, being able to view a roadmap is enough to create a new one working towards it.
      if (!targetRoadmap || !hasViewAccess(accessChecker(targetRoadmap, accessContext))) {
        throw new Error(ClientError.IllegalParent, { cause: 'roadmap' });
      }
    }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (err.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      }
      return Response.json({ message: ClientError.IllegalParent },
        { status: 403 },
      );
    } else {
      // If non-error is thrown, log it and return a generic error message
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // Only allow super admins to create national roadmaps
  if (roadmap.type === RoadmapType.NATIONAL && !accessContext.isSuperAdmin) {
    return Response.json({ message: t('api:roadmap.national_roadmap_forbidden') },
      { status: 403 },
    );
  }

  // Resolve initial sharing settings
  const resolvedAccess = await resolveAccessInput(roadmap.access, roadmap.orgId, accessContext, true);
  if (!resolvedAccess.ok) {
    return Response.json({ message: resolvedAccess.message },
      { status: 400 },
    );
  }

  // Create the new roadmap with its access control
  try {
    const newRoadmap = await prisma.roadmaps.create({
      data: {
        name: roadmap.name,
        description: roadmap.description,
        type: roadmap.type,
        actor: roadmap.actor,
        geo_area: roadmap.geoAreaCode ? { connect: { code: roadmap.geoAreaCode } } : undefined,
        parent_roadmap: roadmap.parentRoadmapId ? { connect: { id: roadmap.parentRoadmapId } } : undefined,
        author: { connect: { id: session.user.id } },
        access_control: {
          create: {
            org: { connect: { id: roadmap.orgId } },
            is_public: resolvedAccess.isPublic,
            org_readable: resolvedAccess.orgReadable,
            grants: {
              createMany: { data: resolvedAccess.grants },
            },
          },
        },
      },
      select: { id: true },
    });
    // Invalidate old cache
    revalidateTag('roadmap', 'max');
    // Return the new roadmap's ID if successful
    return Response.json({ message: t('api:roadmap.roadmap_created'), id: newRoadmap.id },
      { status: 201, headers: { 'Location': `/roadmap/create?roadmapId=${newRoadmap.id}` } },
    );
  }
  catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:roadmap.failed_record_connection') },
        { status: 400 },
      );
    }
    return Response.json({ message: t('api:roadmap.failed_roadmap_creation') },
      { status: 500 },
    );
  }
}

/**
 * Handles PUT requests to the roadmap API
 */
export async function PUT(request: NextRequest) {
  const [session, roadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate request body
  if (!isRoadmapUpdate(roadmap)) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  // If given roadmap type is invalid, set it to OTHER. If type is undefined leave it be; it wont update the existing value in the database
  if (
    roadmap.type !== undefined &&
    !(roadmap.type in RoadmapType)
  ) {
    roadmap.type = RoadmapType.OTHER;
  }

  let accessContext: UserAccessContext;
  let orgId: string;
  try {
    // Get user context, current roadmap, and target parent roadmap (if any)
    const [fetchedContext, currentRoadmap, targetRoadmap] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.roadmaps.findUnique({
        where: { id: roadmap.id },
        select: {
          updated_at: true,
          access_control: { select: accessControlSelection },
        },
      }),
      ...(
        roadmap.parentRoadmapId ?
          [
            prisma.roadmaps.findUnique({
              where: { id: roadmap.parentRoadmapId },
              select: { access_control: { select: accessControlSelection } },
            }),
          ] :
          []
      ),
    ]);
    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!fetchedContext || (session.user.isSuperAdmin && !fetchedContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap' });
    }
    accessContext = fetchedContext;

    // Check if the user has edit access to the current roadmap (accessChecker returns None if no roadmap is found)
    const currentAccess = accessChecker(currentRoadmap, accessContext);
    if (!currentRoadmap || !hasEditAccess(currentAccess)) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap' });
    }

    // Sharing settings are manager-only: read-write grants must not be able to (re)publish content
    if (roadmap.access !== undefined && !hasAdminAccess(currentAccess)) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap' });
    }

    orgId = currentRoadmap.access_control.org_id;

    if (roadmap.parentRoadmapId) {
      // If the user is trying to set a parent roadmap, check if they have at least viewing access to it
      if (!targetRoadmap || !hasViewAccess(accessChecker(targetRoadmap, accessContext))) {
        throw new Error(ClientError.IllegalParent, { cause: 'roadmap' });
      }
    }

    // Check if the client's data is stale
    if (!roadmap.timestamp || (currentRoadmap?.updated_at?.getTime() ?? 0) > roadmap.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'roadmap' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (err.message === ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 },
        );
      }
      if (err.message === ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 },
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 },
      );
    }
    // If non-error is thrown, log it and return a generic error message
    else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // Only allow super admins to make roadmaps national
  if (roadmap.type === RoadmapType.NATIONAL && !accessContext.isSuperAdmin) {
    return Response.json({ message: t('api:roadmap.national_roadmap_forbidden') },
      { status: 403 },
    );
  }

  // Resolve new sharing settings, if any (only admins get this far with them)
  let resolvedAccess: Awaited<ReturnType<typeof resolveAccessInput>> | null = null;
  if (roadmap.access !== undefined) {
    resolvedAccess = await resolveAccessInput(roadmap.access, orgId, accessContext, false);
    if (!resolvedAccess.ok) {
      return Response.json({ message: resolvedAccess.message },
        { status: 400 },
      );
    }
  }

  // Update the roadmap
  try {
    const updatedRoadmap = await prisma.roadmaps.update({
      where: { id: roadmap.id },
      data: {
        name: roadmap.name,
        description: roadmap.description,
        type: roadmap.type,
        actor: roadmap.actor,
        geo_area: roadmap.geoAreaCode === undefined ? undefined
          : roadmap.geoAreaCode === null ? { disconnect: true }
            : { connect: { code: roadmap.geoAreaCode } },
        parent_roadmap: roadmap.parentRoadmapId === undefined ? undefined
          : roadmap.parentRoadmapId === null ? { disconnect: true }
            : { connect: { id: roadmap.parentRoadmapId } },
        ...(resolvedAccess?.ok ? {
          access_control: {
            update: {
              is_public: resolvedAccess.isPublic,
              org_readable: resolvedAccess.orgReadable,
              grants: {
                // Full replacement of the grant set
                deleteMany: {},
                createMany: { data: resolvedAccess.grants },
              },
            },
          },
        } : {}),
      },
      select: { id: true },
    });
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmap', 'max');
    // Return the updated roadmap's ID if successful
    return Response.json({ message: t('api:roadmap.roadmap_updated'), id: updatedRoadmap.id },
      { status: 200, headers: { 'Location': `/roadmap/${updatedRoadmap.id}` } },
    );
  }
  catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:roadmap.failed_record_connection') },
        { status: 400 },
      );
    }
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles DELETE requests to the roadmap API
 */
export async function DELETE(request: NextRequest) {
  const [session, roadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ id: string }>,
  ]);
  const t = await serveTea("api");

  // Validate request body
  if (!roadmap.id) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  try {
    const [accessContext, currentRoadmap] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.roadmaps.findUnique({
        where: { id: roadmap.id },
        select: { access_control: { select: accessControlSelection } },
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap' });
    }

    // Deleting a roadmap requires admin access (org manager or super admin).
    // Also covers roadmaps that don't exist at all.
    if (!hasAdminAccess(accessChecker(currentRoadmap, accessContext))) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 },
      );
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // Delete the roadmap
  try {
    const deletedRoadmap = await prisma.roadmaps.delete({
      where: {
        id: roadmap.id,
      },
      select: {
        id: true,
      },
    });
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmap', 'max');
    return Response.json({ message: t('api:roadmap.roadmap_deleted'), id: deletedRoadmap.id },
      { status: 200, headers: { 'Location': `/` } },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
