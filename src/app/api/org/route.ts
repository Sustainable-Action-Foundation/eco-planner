import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { getSession } from "@/lib/session";
import type { UserAccessContext } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Org management: org managers (and super admins) rename their org and place
// it in a geo area. Org names are unique, and the DB constraint is the source
// of truth for collisions (no racy pre-check). Cached payloads carry org names
// and areas (see getUserOrgs), so a change revalidates the 'org' tag.

function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
  return accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
}

/**
 * Renames an org the requester manages and/or places it in a geo area:
 * `{ orgId, name?, geoAreaCode? }`, where a null `geoAreaCode` takes the org
 * out of its area. At least one of the two is required.
 */
export async function PUT(request: NextRequest) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ orgId?: string, name?: string, geoAreaCode?: string | null }>,
    serveTea("api"),
  ]);

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }
  const accessContext = await getAccessContextById(session.user.id);
  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  // undefined leaves the area alone, null (or an empty code) clears it
  const geoAreaCode = body.geoAreaCode === undefined ? undefined : (typeof body.geoAreaCode === 'string' && body.geoAreaCode ? body.geoAreaCode : null);
  if (!body.orgId || typeof body.orgId !== 'string' || (!name && geoAreaCode === undefined) || (body.name !== undefined && !name)) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  const org = await prisma.orgs.findUnique({
    where: { id: body.orgId },
    select: { id: true },
  });
  if (!org || !managesOrg(accessContext, org.id)) {
    // A 404 for existing-but-unmanaged orgs too, to not leak their existence
    return Response.json({ message: t('api:org.not_found') },
      { status: 404 },
    );
  }

  if (geoAreaCode && !await prisma.geoAreas.findUnique({ where: { code: geoAreaCode }, select: { code: true } })) {
    return Response.json({ message: t('api:org.unknown_area') },
      { status: 400 },
    );
  }

  try {
    await prisma.orgs.update({
      where: { id: org.id },
      data: {
        ...(name ? { name } : {}),
        ...(geoAreaCode !== undefined ? { geo_area_code: geoAreaCode } : {}),
      },
    });
  }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ message: t('api:org.name_taken') },
        { status: 409 },
      );
    }
    console.error("Error renaming org", { error });
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }

  revalidateTag('org', { expire: 0 });

  return Response.json({ message: name ? t('api:org.renamed') : t('api:org.area_updated') },
    { status: 200 },
  );
}
