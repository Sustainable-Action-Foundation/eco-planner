import { revalidateTag } from "next/cache";
import { getAccessContextFor } from "@/fetchers/getUserAccessContext";
import { readJsonObject } from "@/functions/readJson";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { normalizeEmail } from "@/functions/email";
import { assignableRole, browsesAllUsers, managesMembers, memberLookupRate, movedRole, movesMember, removesMember } from "@/functions/orgMembership";
import { looksLikeEmail } from "@/lib/authToken";
import { consumeToken } from "@/lib/rateLimit";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";

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
    readJsonObject(request),
    serveTea("api"),
  ]);

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }
  const accessContext = await getAccessContextFor(session.user);
  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
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
      data: {
        role,
        // Latest-change trail; a lightweight stand-in for a proper audit log
        role_changed_at: new Date(),
        role_changed_by: { connect: { id: session.user.id } },
      },
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

// Membership administration: adding an existing user to an org (POST), removing a
// member (DELETE) and moving a member to another org (PATCH). The org's managers and
// super admins may; who exactly may do what is decided in `@/functions/orgMembership`
// (see the matrix there). Everyone else gets the answers the other org routes give:
// 403 on create, 404 on an id, so nothing about a membership leaks.
//
// Nothing here touches the user's session: memberships are not in the cookie, the
// access context is read from the database on every request, and cached readers
// take it as part of their key. A changed membership therefore applies on the
// user's next request. The 'org' tag is revalidated for what is keyed by org
// rather than by viewer and depends on who the members are (the like rankings).
//
// Enrolment by e-mail domain only happens when an account is created (see
// /api/login-link), so what is set here stays until someone changes it again.

/** The signed-in requester's id and access context, or null when not signed in */
async function getRequester(): Promise<{ userId: string, accessContext: UserAccessContext } | null> {
  const session = await getSession(await cookies());
  if (!session.user?.id) {
    return null;
  }
  const accessContext = await getAccessContextFor(session.user);
  return accessContext ? { userId: session.user.id, accessContext } : null;
}

/**
 * Adds an existing user to an org: `{ orgId, email, role? }` or `{ orgId, userId, role? }`,
 * role MEMBER (default) or MANAGER.
 *
 * Managers name the user by their exact e-mail address: they never get to see who has
 * an account. The answer does tell whether that one address has one ("no account with
 * that address"), which is acceptable from a signed-in manager of an org, and their
 * lookups are rate-limited. `userId` is for the user list, which only super admins get.
 */
export async function POST(request: NextRequest) {
  const [requester, body, t] = await Promise.all([
    getRequester(),
    readJsonObject(request),
    serveTea("api"),
  ]);

  if (!requester) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }
  const role = body.role === undefined ? OrgRole.MEMBER : assignableRole(body.role);
  const userId = typeof body.userId === 'string' && body.userId ? body.userId : null;
  const email = typeof body.email === 'string' && body.email.trim() ? normalizeEmail(body.email) : null;
  // Exactly one way of naming the user
  if (!body.orgId || typeof body.orgId !== 'string' || !role || (userId === null) === (email === null)) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  if (!managesMembers(requester.accessContext, body.orgId)) {
    return Response.json({ message: t('api:orgMembership.manager_only') },
      { status: 403 },
    );
  }
  const seesAllUsers = browsesAllUsers(requester.accessContext);
  if (userId && !seesAllUsers) {
    return Response.json({ message: t('api:orgMembership.super_admin_only') },
      { status: 403 },
    );
  }
  if (email && !looksLikeEmail(email)) {
    return Response.json({ message: t('api:orgMembership.invalid_email') },
      { status: 400 },
    );
  }
  // Every lookup by address counts, found or not: the answer says whether an account exists
  if (email && !seesAllUsers && !consumeToken(`org-member-lookup:${requester.userId}`, memberLookupRate)) {
    return Response.json({ message: t('api:orgMembership.rate_limited') },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  const [org, user] = await Promise.all([
    prisma.orgs.findUnique({ where: { id: body.orgId }, select: { id: true } }),
    prisma.users.findUnique({
      where: userId ? { id: userId } : { email: email ?? "" },
      select: { id: true, memberships: { where: { org_id: body.orgId }, select: { id: true } } },
    }),
  ]);
  if (!org) {
    return Response.json({ message: t('api:org.not_found') },
      { status: 404 },
    );
  }
  if (!user) {
    return Response.json({ message: userId ? t('api:orgMembership.user_not_found') : t('api:orgMembership.no_account') },
      { status: 404 },
    );
  }
  // Any row counts, a lingering guest one included: remove that first to re-add the user as a member
  if (user.memberships.length > 0) {
    return Response.json({ message: t('api:orgMembership.already_member') },
      { status: 409 },
    );
  }

  let membershipId: string;
  try {
    const created = await prisma.orgMemberships.create({
      data: {
        user: { connect: { id: user.id } },
        org: { connect: { id: org.id } },
        role,
        // The same latest-change trail as role changes: who put the user here and when
        role_changed_at: new Date(),
        role_changed_by: { connect: { id: requester.userId } },
      },
      select: { id: true },
    });
    membershipId = created.id;
  }
  catch (error) {
    // Two requests adding the same user at once: the unique key is the source of truth
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: t('api:orgMembership.already_member') },
        { status: 409 },
      );
    }
    console.error("Error adding org member", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  revalidateTag('org', { expire: 0 });

  return Response.json({ message: t('api:orgMembership.added'), id: membershipId },
    { status: 201 },
  );
}

/**
 * Removes a member from an org: `{ membershipId }`. The member's group memberships in
 * the org cascade away. Managers cannot remove themselves; super admins can.
 */
export async function DELETE(request: NextRequest) {
  const [requester, body, t] = await Promise.all([
    getRequester(),
    readJsonObject(request),
    serveTea("api"),
  ]);

  if (!requester) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }
  if (!body.membershipId || typeof body.membershipId !== 'string') {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const membership = await prisma.orgMemberships.findUnique({
    where: { id: body.membershipId },
    select: { id: true, org_id: true, user_id: true },
  });
  if (!membership || !managesMembers(requester.accessContext, membership.org_id)) {
    // A 404 for memberships of orgs the requester does not manage too, to not leak their existence
    return Response.json({ message: t('api:orgMembership.not_found') },
      { status: 404 },
    );
  }
  if (!removesMember(requester.accessContext, membership.org_id, membership.user_id === requester.userId)) {
    return Response.json({ message: t('api:orgMembership.own_membership') },
      { status: 400 },
    );
  }

  try {
    // Content stays: everything is owned by the org, authorship is cosmetic
    await prisma.orgMemberships.delete({ where: { id: membership.id } });
  }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ message: t('api:orgMembership.not_found') },
        { status: 404 },
      );
    }
    console.error("Error removing org member", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  revalidateTag('org', { expire: 0 });

  return Response.json({ message: t('api:orgMembership.removed') },
    { status: 200 },
  );
}

/**
 * Moves a member to another org: `{ membershipId, orgId, role? }`. The membership in
 * the old org is deleted and one in the new org created, both or neither. The role
 * comes along unless another is asked for; group memberships cannot (groups belong
 * to one org), so the user starts in the new org without any.
 *
 * Super admins move anyone anywhere. A manager moves a member only to another org
 * they manage too, and never themselves.
 */
export async function PATCH(request: NextRequest) {
  const [requester, body, t] = await Promise.all([
    getRequester(),
    readJsonObject(request),
    serveTea("api"),
  ]);

  if (!requester) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }
  if (!body.membershipId || typeof body.membershipId !== 'string' || !body.orgId || typeof body.orgId !== 'string'
    || (body.role !== undefined && !assignableRole(body.role))) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const membership = await prisma.orgMemberships.findUnique({
    where: { id: body.membershipId },
    select: { id: true, org_id: true, role: true, user_id: true },
  });
  if (!membership || !managesMembers(requester.accessContext, membership.org_id)) {
    return Response.json({ message: t('api:orgMembership.not_found') },
      { status: 404 },
    );
  }
  const isOwnMembership = membership.user_id === requester.userId;
  if (!removesMember(requester.accessContext, membership.org_id, isOwnMembership)) {
    return Response.json({ message: t('api:orgMembership.own_membership') },
      { status: 400 },
    );
  }
  if (membership.org_id === body.orgId) {
    return Response.json({ message: t('api:orgMembership.same_org') },
      { status: 400 },
    );
  }
  // Both ends. Answered before the target is looked up, so it says nothing about which orgs exist
  if (!movesMember(requester.accessContext, membership.org_id, body.orgId, isOwnMembership)) {
    return Response.json({ message: t('api:orgMembership.move_managed_only') },
      { status: 403 },
    );
  }

  const [target, existing] = await Promise.all([
    prisma.orgs.findUnique({ where: { id: body.orgId }, select: { id: true } }),
    prisma.orgMemberships.findUnique({ where: { user_id_org_id: { user_id: membership.user_id, org_id: body.orgId } }, select: { id: true } }),
  ]);
  if (!target) {
    return Response.json({ message: t('api:org.not_found') },
      { status: 404 },
    );
  }
  if (existing) {
    return Response.json({ message: t('api:orgMembership.already_member') },
      { status: 409 },
    );
  }

  let membershipId: string;
  try {
    // One transaction, so the user is never left in both orgs or in neither. Create
    // before delete all the same: should a statement ever escape the transaction,
    // a user in both orgs is the failure that is visible and loses nothing.
    const [created] = await prisma.$transaction([
      prisma.orgMemberships.create({
        data: {
          user: { connect: { id: membership.user_id } },
          org: { connect: { id: target.id } },
          role: movedRole(body.role, membership.role),
          role_changed_at: new Date(),
          role_changed_by: { connect: { id: requester.userId } },
        },
        select: { id: true },
      }),
      prisma.orgMemberships.delete({ where: { id: membership.id } }),
    ]);
    membershipId = created.id;
  }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: t('api:orgMembership.already_member') },
        { status: 409 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return Response.json({ message: t('api:orgMembership.not_found') },
        { status: 404 },
      );
    }
    console.error("Error moving org member", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  revalidateTag('org', { expire: 0 });

  return Response.json({ message: t('api:orgMembership.moved'), id: membershipId },
    { status: 200 },
  );
}
