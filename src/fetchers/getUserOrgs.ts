import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import type { GeoAreaType } from "@/lib/prisma/generated";
import { cacheTag } from "next/cache";

export type UserOrg = {
  id: string,
  name: string,
  /** The user holds a membership in the org (false only for the super-admin override) */
  isMember: boolean,
  isGuest: boolean,
  geoArea: { code: string, name: string, type: GeoAreaType } | null,
};

/**
 * The orgs shown in the start page's org switcher: every membership, guest ones
 * included — the org a guest was invited into is the whole point of their
 * account. Super admins get every org, memberships listed first, so they can
 * traverse orgs they were never enrolled in. `isGuest` lets the start page keep
 * guests off the org landing by default (they reach it through its tab), since
 * guests only see what their groups are explicitly granted.
 *
 * NOTE: Guests are disabled until further notice: the access context drops
 * GUEST memberships at the root (see getUserAccessContext), so `isGuest` is
 * currently never true here.
 */
export async function getUserOrgs(): Promise<UserOrg[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext || (!accessContext.isSuperAdmin && !accessContext.memberships.length)) {
    return [];
  }

  const orgs = await getCachedOrgs(accessContext.isSuperAdmin ? null : accessContext.memberships.map(membership => membership.orgId));
  const userOrgs = orgs.map(org => {
    const membership = accessContext.memberships.find(membership => membership.orgId === org.id);
    return {
      id: org.id,
      name: org.name,
      isMember: !!membership,
      isGuest: membership?.role === OrgRole.GUEST,
      geoArea: org.geo_area,
    };
  });

  // Memberships first, then the rest; the query keeps each half alphabetical
  return [...userOrgs.filter(org => org.isMember), ...userOrgs.filter(org => !org.isMember)];
}

/**
 * Caches the org names per org-id set (org names practically never change).
 * `null` fetches every org (the super-admin override).
 */
async function getCachedOrgs(orgIds: string[] | null): Promise<{ id: string, name: string, geo_area: { code: string, name: string, type: GeoAreaType } | null }[]> {
  'use cache';
  cacheTag('database', 'org');

  try {
    return await prisma.orgs.findMany({
      where: orgIds ? { id: { in: orgIds } } : {},
      select: { id: true, name: true, geo_area: { select: { code: true, name: true, type: true } } },
      orderBy: { name: 'asc' },
    });
  }
  catch (err) {
    console.error("Error fetching user orgs", { err });
    return [];
  }
}
