import "server-only";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { cookies } from "next/headers";

/**
 * Builds the requesting user's access context (super_admin flag + org roles + group ids) fresh from the database.
 * Deliberately uncached: manager edits to groups and grants must apply on the user's next request, without re-login.
 *
 * Returns null for anonymous visitors and for stale sessions whose user no longer exists.
 */
export async function getUserAccessContext(): Promise<UserAccessContext | null> {
  const session = await getSession(await cookies());
  if (!session.user?.isLoggedIn) {
    return null;
  }
  return getAccessContextById(session.user.id);
}

/**
 * Same as `getUserAccessContext`, for callers that have already read the session (e.g. API routes).
 */
export async function getAccessContextById(userId: string): Promise<UserAccessContext | null> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        is_super_admin: true,
        memberships: {
          select: {
            org_id: true,
            role: true,
            group_memberships: { select: { group_id: true } },
          },
        },
      },
    });
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      isSuperAdmin: user.is_super_admin,
      // NOTE: Guests are disabled until further notice. GUEST memberships are
      // dropped here at the root, so any lingering GUEST row grants nothing
      // anywhere: no group grants, no org tab, no visibility. Remove the filter
      // to re-enable guests.
      memberships: user.memberships.filter(membership => membership.role !== OrgRole.GUEST).map(membership => ({
        orgId: membership.org_id,
        role: membership.role,
        groupIds: membership.group_memberships.map(groupMembership => groupMembership.group_id),
      })),
    };
  }
  catch (err) {
    console.error("Error building user access context", { err });
    return null;
  }
}
