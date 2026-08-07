import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Org role management: managers (and super admins) promote members to managers
// and demote managers back to members. Guest roles are out of scope here (guest
// status defines a different access relationship, not a rank), and nobody can
// change their own role, so an org can't manage away its last manager by accident.

function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
  return accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
}

/** Sets a membership's role to MEMBER or MANAGER */
export async function PUT(request: NextRequest) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ membershipId?: string, role?: string }>,
    serveTea("api"),
  ]);

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }
  const accessContext = await getAccessContextById(session.user.id);
  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  const role = body.role === OrgRole.MANAGER ? OrgRole.MANAGER
    : body.role === OrgRole.MEMBER ? OrgRole.MEMBER
      : null;
  if (!body.membershipId || typeof body.membershipId !== 'string' || !role) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const membership = await prisma.orgMemberships.findUnique({
    where: { id: body.membershipId },
    select: { id: true, org_id: true, role: true, user_id: true },
  });
  if (!membership || !managesOrg(accessContext, membership.org_id)) {
    // A 404 for existing-but-unmanaged memberships too, to not leak their existence
    return Response.json({ message: t('api:orgMembership.not_found') },
      { status: 404 },
    );
  }

  if (membership.user_id === session.user.id) {
    return Response.json({ message: t('api:orgMembership.own_role') },
      { status: 400 },
    );
  }
  if (membership.role === OrgRole.GUEST) {
    return Response.json({ message: t('api:orgMembership.guest_locked') },
      { status: 400 },
    );
  }

  try {
    await prisma.orgMemberships.update({
      where: { id: membership.id },
      data: { role },
    });
  }
  catch (error) {
    console.error("Error updating org membership role", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  return Response.json({ message: t('api:orgMembership.updated') },
    { status: 200 },
  );
}
