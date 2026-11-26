import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { browsesAllUsers, managesMembers } from "@/functions/orgMembership";
import { displayName } from "@/functions/personName";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";

/** What only super admins get about a user; the address tells namesakes apart */
type UserDetails = {
  email: string,
  /** Names of the orgs the user belongs to, other than the one being managed */
  otherOrgs: string[],
};

export type OrgMemberAdmin = {
  orgId: string,
  /**
   * The org's memberships, each of which can be removed or moved. Addresses and other
   * orgs only for super admins: a manager sees the names they already see on the page.
   */
  members: ({
    membershipId: string,
    /** What to show: "First Last", or the username until the person has filled in their name */
    name: string,
    role: OrgRole,
  } & Partial<UserDetails>)[],
  /** The requester's own membership when they may neither remove nor move it (managers); null for super admins */
  lockedMembershipId: string | null,
  /** Where a manager may move a member: the other orgs they manage. Empty for super admins, who move anywhere (`everyone.orgs`) */
  managedOrgs: { id: string, name: string }[],
  /** What only super admins with their powers on get; null for managers, who add by typing an exact address */
  everyone: {
    /** Every user without a membership in the org: the ones that can be added */
    candidates: (UserDetails & { userId: string, name: string })[],
    /** Every other org: where a member can be moved */
    orgs: { id: string, name: string }[],
  } | null,
};

const byName = (a: { name: string, email?: string }, b: { name: string, email?: string }) => a.name.localeCompare(b.name, "sv-SE") || (a.email ?? "").localeCompare(b.email ?? "", "sv-SE");

/**
 * What the manage page needs to add, remove and move members. For those who decide
 * over the org's members (its managers and super admins, see `@/functions/orgMembership`);
 * null for everyone else. Only super admins with their powers on get the list of every
 * user, the addresses and every org: none of that ever reaches a manager.
 * Uncached, like `getOrgManagement`: membership data must be fresh here.
 */
export async function getOrgMemberAdmin(orgId: string): Promise<OrgMemberAdmin | null> {
  const accessContext = await getUserAccessContext();
  if (!accessContext || !managesMembers(accessContext, orgId)) {
    return null;
  }

  try {
    if (!browsesAllUsers(accessContext)) {
      const managedOrgIds = accessContext.memberships
        .filter(membership => membership.role === OrgRole.MANAGER && membership.orgId !== orgId)
        .map(membership => membership.orgId);
      const [memberships, managedOrgs] = await Promise.all([
        prisma.orgMemberships.findMany({
          where: { org_id: orgId },
          select: { id: true, role: true, user_id: true, user: { select: { username: true, first_name: true, last_name: true } } },
        }),
        managedOrgIds.length > 0
          ? prisma.orgs.findMany({ where: { id: { in: managedOrgIds } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
          : [],
      ]);

      return {
        orgId,
        members: memberships.map(membership => ({ membershipId: membership.id, name: displayName(membership.user), role: membership.role })).sort(byName),
        lockedMembershipId: memberships.find(membership => membership.user_id === accessContext.id)?.id ?? null,
        managedOrgs,
        everyone: null,
      };
    }

    const [users, orgs] = await Promise.all([
      prisma.users.findMany({
        select: {
          id: true,
          username: true,
          first_name: true,
          last_name: true,
          email: true,
          memberships: { select: { id: true, org_id: true, role: true, org: { select: { name: true } } } },
        },
      }),
      prisma.orgs.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    if (!orgs.some(org => org.id === orgId)) {
      return null;
    }

    const members: OrgMemberAdmin["members"] = [];
    const candidates: NonNullable<OrgMemberAdmin["everyone"]>["candidates"] = [];
    for (const user of users) {
      const shared = {
        name: displayName(user),
        email: user.email,
        otherOrgs: user.memberships.filter(membership => membership.org_id !== orgId).map(membership => membership.org.name).sort((a, b) => a.localeCompare(b, "sv-SE")),
      };
      // Any row makes a member here, a lingering guest one included: the user cannot be added on top of it
      const membership = user.memberships.find(membership => membership.org_id === orgId);
      if (membership) {
        members.push({ ...shared, membershipId: membership.id, role: membership.role });
      }
      else {
        candidates.push({ ...shared, userId: user.id });
      }
    }

    return {
      orgId,
      members: members.sort(byName),
      lockedMembershipId: null,
      managedOrgs: [],
      everyone: {
        candidates: candidates.sort(byName),
        orgs: orgs.filter(org => org.id !== orgId),
      },
    };
  }
  catch (err) {
    console.error("Error fetching org member administration data", { err });
    return null;
  }
}
