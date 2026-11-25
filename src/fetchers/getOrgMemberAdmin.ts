import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { administersMembers } from "@/functions/orgMembership";
import { displayName } from "@/functions/personName";
import { prisma } from "@/lib/prisma";
import type { OrgRole } from "@/lib/prisma/generated";

/** A user as the membership administration shows them; the address tells namesakes apart */
type AdminUser = {
  /** What to show: "First Last", or the username until the person has filled in their name */
  name: string,
  email: string,
  /** Names of the orgs the user belongs to, other than the one being managed */
  otherOrgs: string[],
};

export type OrgMemberAdmin = {
  orgId: string,
  /** The org's memberships, each of which can be removed or moved */
  members: (AdminUser & { membershipId: string, role: OrgRole })[],
  /** Every user without a membership in the org: the ones that can be added */
  candidates: (AdminUser & { userId: string })[],
  /** Every other org: where a member can be moved */
  orgs: { id: string, name: string }[],
};

/**
 * What the manage page needs to add, remove and move members: the org's members, every
 * other user and every other org. Only for those who administer memberships (super
 * admins with their powers on, see `administersMembers`); null for everyone else,
 * managers included, so user addresses never reach them.
 * Uncached, like `getOrgManagement`: membership data must be fresh here.
 */
export async function getOrgMemberAdmin(orgId: string): Promise<OrgMemberAdmin | null> {
  const accessContext = await getUserAccessContext();
  if (!administersMembers(accessContext, orgId)) {
    return null;
  }

  try {
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
    const candidates: OrgMemberAdmin["candidates"] = [];
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
    const byName = (a: AdminUser, b: AdminUser) => a.name.localeCompare(b.name, "sv-SE") || a.email.localeCompare(b.email, "sv-SE");

    return {
      orgId,
      members: members.sort(byName),
      candidates: candidates.sort(byName),
      orgs: orgs.filter(org => org.id !== orgId),
    };
  }
  catch (err) {
    console.error("Error fetching org member administration data", { err });
    return null;
  }
}
