import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { cacheTag } from "next/cache";

export type UserOrg = { id: string, name: string };

/**
 * The orgs whose landing pages the requesting user gets on the start page:
 * proper (non-guest) memberships only. Guests are cross-org contributors and
 * keep the public start page, like users without an org.
 */
export async function getUserOrgs(): Promise<UserOrg[]> {
  const accessContext = await getUserAccessContext();
  const orgIds = accessContext?.memberships
    .filter(membership => membership.role !== OrgRole.GUEST)
    .map(membership => membership.orgId)
    ?? [];

  if (!orgIds.length) {
    return [];
  }
  return getCachedOrgs(orgIds);
}

/** Caches the org names per org-id set (org names practically never change). */
async function getCachedOrgs(orgIds: string[]): Promise<UserOrg[]> {
  'use cache';
  cacheTag('database', 'org');

  try {
    return await prisma.orgs.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  catch (err) {
    console.error("Error fetching user orgs", { err });
    return [];
  }
}
