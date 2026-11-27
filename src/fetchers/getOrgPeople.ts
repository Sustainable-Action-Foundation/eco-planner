import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { displayName } from "@/functions/personName";
import { managesOrg } from "@/lib/accessChecker";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { cacheTag } from "next/cache";

/** The people of an org as its landing page shows them; each part only to those who may have it */
export type OrgPeople = {
  /** The org's managers by display name; empty for anonymous viewers, who get no names of people */
  managers: string[],
  /** Proper members (guests aside); null unless the viewer is a member of the org or a super admin */
  memberCount: number | null,
  /** Of the members, those who haven't liked any goal; null unless the viewer manages the org */
  membersWithoutLikes: number | null,
};

const nobody: OrgPeople = { managers: [], memberCount: null, membersWithoutLikes: null };

/**
 * Who is in the org, cut down to what the requesting user may know: manager names take
 * a login, the member count a membership, and how many members have yet to like
 * anything is for the org's managers (the member list itself stays on the management page).
 * @param options.asVisitor What a visitor without a login gets, whoever asks (the public view's preview)
 */
export async function getOrgPeople(orgId: string, options: { asVisitor?: boolean } = {}): Promise<OrgPeople> {
  const accessContext = options.asVisitor ? null : await getUserAccessContext();
  if (!accessContext) return nobody;

  const people = await uncachedFallback<Awaited<ReturnType<typeof getCachedOrgPeople>> | null>(() => getCachedOrgPeople(orgId), null, "Error fetching org people", { orgId });
  if (!people) return nobody;

  const isMember = accessContext.isSuperAdmin || accessContext.memberships.some(membership => membership.orgId === orgId);
  return {
    managers: people.managers,
    memberCount: isMember ? people.memberCount : null,
    membersWithoutLikes: managesOrg(accessContext, orgId) ? people.membersWithoutLikes : null,
  };
}

/**
 * Caches the org's people per org; the wrapper decides who gets what. Role changes
 * revalidate 'org', likes 'goalLike', name changes and a first login (which may enrol a
 * new member) 'user'.
 */
async function getCachedOrgPeople(orgId: string): Promise<{ managers: string[], memberCount: number, membersWithoutLikes: number }> {
  'use cache';
  cacheTag('database', 'org', 'goalLike', 'user');

  return boundedFill("getCachedOrgPeople", async () => {
    const memberships = await prisma.orgMemberships.findMany({
      where: { org_id: orgId, role: { not: OrgRole.GUEST } },
      select: {
        role: true,
        user: { select: { username: true, first_name: true, last_name: true, _count: { select: { goal_likes: true } } } },
      },
    });

    return {
      managers: memberships
        .filter(membership => membership.role === OrgRole.MANAGER)
        .map(membership => displayName(membership.user))
        .sort((a, b) => a.localeCompare(b, "sv")),
      memberCount: memberships.length,
      membersWithoutLikes: memberships.filter(membership => membership.user._count.goal_likes === 0).length,
    };
  });
}
