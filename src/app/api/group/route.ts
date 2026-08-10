import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Group management: org managers (and super admins) create, rename, re-member
// and delete their org's groups. Deleting a group cascades away its memberships
// and access grants. No cache revalidation is needed: cached payloads carry
// only group ids, and group membership resolves through the per-request access
// context.

function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
  return accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
}

/** Resolves the requester's access context, or null when not signed in */
async function getRequestContext(): Promise<UserAccessContext | null> {
  const session = await getSession(await cookies());
  if (!session.user?.id) {
    return null;
  }
  return getAccessContextById(session.user.id);
}

/** Keeps only ids that are actual memberships of the given org (the composite FKs would reject others anyway) */
async function validMembershipIds(orgId: string, memberIds: string[]): Promise<string[]> {
  if (!memberIds.length) {
    return [];
  }
  const memberships = await prisma.orgMemberships.findMany({
    where: { org_id: orgId, id: { in: memberIds } },
    select: { id: true },
  });
  return memberships.map(membership => membership.id);
}

/** Creates a new group in an org the requester manages */
export async function POST(request: NextRequest) {
  const [accessContext, body, t] = await Promise.all([
    getRequestContext(),
    request.json() as Promise<{ orgId?: string, name?: string, memberIds?: string[] }>,
    serveTea("api"),
  ]);

  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter(id => typeof id === 'string') : [];
  if (!body.orgId || typeof body.orgId !== 'string' || !name) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  if (!managesOrg(accessContext, body.orgId)) {
    return Response.json({ message: t('api:group.manager_only') },
      { status: 403 },
    );
  }

  try {
    const memberships = await validMembershipIds(body.orgId, memberIds);
    await prisma.groups.create({
      data: {
        name,
        org: { connect: { id: body.orgId } },
        memberships: {
          createMany: { data: memberships.map(membershipId => ({ membership_id: membershipId })) },
        },
      },
    });
  }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: t('api:group.name_taken') },
        { status: 400 },
      );
    }
    console.error("Error creating group", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  return Response.json({ message: t('api:group.created') },
    { status: 201 },
  );
}

/** Renames a group and/or replaces its member set */
export async function PUT(request: NextRequest) {
  const [accessContext, body, t] = await Promise.all([
    getRequestContext(),
    request.json() as Promise<{ groupId?: string, name?: string, memberIds?: string[] }>,
    serveTea("api"),
  ]);

  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (!body.groupId || typeof body.groupId !== 'string' || name === '') {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const group = await prisma.groups.findUnique({
    where: { id: body.groupId },
    select: { id: true, org_id: true },
  });
  if (!group || !managesOrg(accessContext, group.org_id)) {
    // A 404 for existing-but-unmanaged groups too, to not leak their existence
    return Response.json({ message: t('api:group.not_found') },
      { status: 404 },
    );
  }

  try {
    const memberships = Array.isArray(body.memberIds)
      ? await validMembershipIds(group.org_id, body.memberIds.filter(id => typeof id === 'string'))
      : undefined;
    await prisma.groups.update({
      where: { id: group.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(memberships !== undefined ? {
          memberships: {
            deleteMany: {},
            createMany: { data: memberships.map(membershipId => ({ membership_id: membershipId })) },
          },
        } : {}),
      },
    });
  }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: t('api:group.name_taken') },
        { status: 400 },
      );
    }
    console.error("Error updating group", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  return Response.json({ message: t('api:group.updated') },
    { status: 200 },
  );
}

/** Deletes a group (its memberships and access grants cascade away) */
export async function DELETE(request: NextRequest) {
  const [accessContext, body, t] = await Promise.all([
    getRequestContext(),
    request.json() as Promise<{ groupId?: string }>,
    serveTea("api"),
  ]);

  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body.groupId || typeof body.groupId !== 'string') {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const group = await prisma.groups.findUnique({
    where: { id: body.groupId },
    select: { id: true, org_id: true },
  });
  if (!group || !managesOrg(accessContext, group.org_id)) {
    return Response.json({ message: t('api:group.not_found') },
      { status: 404 },
    );
  }

  try {
    await prisma.groups.delete({ where: { id: group.id } });
  }
  catch (error) {
    console.error("Error deleting group", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  return Response.json({ message: t('api:group.deleted') },
    { status: 200 },
  );
}
