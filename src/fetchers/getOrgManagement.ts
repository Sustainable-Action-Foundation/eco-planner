import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";

export type OrgManagement = {
  org: { id: string, name: string },
  /** All memberships of the org (group membership hangs off these, not off users) */
  members: {
    membershipId: string,
    username: string,
    role: OrgRole,
    /** Orgs (other than this one) where the user is a proper non-guest member; annotates where guests come from */
    homeOrgs: string[],
  }[],
  groups: { id: string, name: string, memberIds: string[] }[],
  /** Pending guest invites (they are deleted when accepted, so all rows are pending) */
  invites: { token: string, email: string, createdAt: Date }[],
  /** The requester's own membership in the org, if any (super admins may have none); the UI locks changing one's own role */
  selfMembershipId: string | null,
};

/**
 * The data the group-management page needs: the org, its members, and its
 * groups with their memberships. Manager-only (super admins manage everywhere);
 * returns null for anyone else, including regular members.
 * Uncached: membership and group data must be fresh for management.
 */
export async function getOrgManagement(orgId: string): Promise<OrgManagement | null> {
  const accessContext = await getUserAccessContext();
  const isManager = !!accessContext && (accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER));
  if (!accessContext || !isManager) {
    return null;
  }

  try {
    const org = await prisma.orgs.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        memberships: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                // The user's proper memberships elsewhere, to show where guests come from
                memberships: {
                  where: { role: { not: OrgRole.GUEST }, org_id: { not: orgId } },
                  select: { org: { select: { name: true } } },
                  orderBy: { org: { name: 'asc' } },
                },
              },
            },
          },
          orderBy: { user: { username: 'asc' } },
        },
        groups: {
          select: { id: true, name: true, memberships: { select: { membership_id: true } } },
          orderBy: { name: 'asc' },
        },
        guest_invites: {
          select: { token: true, email: true, created_at: true },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    if (!org) {
      return null;
    }

    return {
      org: { id: org.id, name: org.name },
      members: org.memberships.map(membership => ({
        membershipId: membership.id,
        username: membership.user.username,
        role: membership.role,
        homeOrgs: membership.user.memberships.map(homeMembership => homeMembership.org.name),
      })),
      groups: org.groups.map(group => ({
        id: group.id,
        name: group.name,
        memberIds: group.memberships.map(membership => membership.membership_id),
      })),
      invites: org.guest_invites.map(invite => ({
        token: invite.token,
        email: invite.email,
        createdAt: invite.created_at,
      })),
      selfMembershipId: org.memberships.find(membership => membership.user.id === accessContext.id)?.id ?? null,
    };
  }
  catch (err) {
    console.error("Error fetching org management data", { err });
    return null;
  }
}
