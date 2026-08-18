import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { cacheTag } from "next/cache";

export type UserOrg = { id: string, name: string, isGuest: boolean, geoArea: { code: string, name: string } | null };

/**
 * The orgs shown in the start page's org switcher: every membership, guest ones
 * included — the org a guest was invited into is the whole point of their
 * account. `isGuest` lets the start page keep guests off the org landing by
 * default (they reach it through its tab), since guests only see what their
 * groups are explicitly granted.
 *
 * NOTE: Guests are disabled until further notice: the access context drops
 * GUEST memberships at the root (see getUserAccessContext), so `isGuest` is
 * currently never true here.
 */
export async function getUserOrgs(): Promise<UserOrg[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext?.memberships.length) {
    return [];
  }

  const orgs = await getCachedOrgs(accessContext.memberships.map(membership => membership.orgId));
  return orgs.map(org => ({
    id: org.id,
    name: org.name,
    isGuest: accessContext.memberships.find(membership => membership.orgId === org.id)?.role === OrgRole.GUEST,
    geoArea: org.geo_area,
  }));
}

/** Caches the org names per org-id set (org names practically never change). */
async function getCachedOrgs(orgIds: string[]): Promise<{ id: string, name: string, geo_area: { code: string, name: string } | null }[]> {
  'use cache';
  cacheTag('database', 'org');

  try {
    return await prisma.orgs.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, geo_area: { select: { code: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }
  catch (err) {
    console.error("Error fetching user orgs", { err });
    return [];
  }
}
