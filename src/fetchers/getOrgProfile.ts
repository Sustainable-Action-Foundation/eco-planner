import "server-only";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { prisma } from "@/lib/prisma";
import type { GeoAreaType, OrgType } from "@/lib/prisma/generated";
import { cacheTag } from "next/cache";

/** What an org's landing page says about the org itself; nothing here depends on the viewer */
export type OrgProfile = {
  id: string,
  name: string,
  geoArea: { code: string, name: string, type: GeoAreaType, parent: { code: string, name: string, type: GeoAreaType } | null } | null,
  /** When the landing banner was uploaded (its URL's version); null when the org has none */
  bannerUpdatedAt: Date | null,
  /** The public profile the org's managers have written; each null until they do */
  description: string | null,
  orgType: OrgType | null,
  contactEmail: string | null,
  website: string | null,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The public profile of an org, for its landing page: anyone may open an org's
 * public view, so this takes no access context. Null for unknown ids (and for
 * anything that isn't an id, without asking the database).
 */
export async function getOrgProfile(orgId: string): Promise<OrgProfile | null> {
  if (!uuidPattern.test(orgId)) return null;
  return uncachedFallback(() => getCachedOrgProfile(orgId), null, "Error fetching org profile", { orgId });
}

async function getCachedOrgProfile(orgId: string): Promise<OrgProfile | null> {
  'use cache';
  cacheTag('database', 'org');

  return boundedFill("getCachedOrgProfile", async () => {
    const area = { code: true, name: true, type: true } as const;
    const org = await prisma.orgs.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        banner_updated_at: true,
        description: true,
        org_type: true,
        contact_email: true,
        website: true,
        geo_area: { select: { ...area, parent: { select: area } } },
      },
    });
    if (!org) return null;
    return {
      id: org.id,
      name: org.name,
      geoArea: org.geo_area,
      bannerUpdatedAt: org.banner_updated_at,
      description: org.description,
      orgType: org.org_type,
      contactEmail: org.contact_email,
      website: org.website,
    };
  });
}
