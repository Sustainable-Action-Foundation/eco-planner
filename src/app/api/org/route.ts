import { getAccessContextFor } from "@/fetchers/getUserAccessContext";
import { OrgProfileRejection, parseOrgProfile } from "@/functions/orgProfile";
import { readJsonObject } from "@/functions/readJson";
import { managesOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { getSession } from "@/lib/session";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Org management: org managers (and super admins) rename their org, place
// it in a geo area, write its public profile and set the focus of its process. Org names are unique, and the DB constraint is the source
// of truth for collisions (no racy pre-check). Cached payloads carry org names
// and areas (see getUserOrgs), so a change revalidates the 'org' tag.

/**
 * Renames an org the requester manages, places it in a geo area and/or sets its
 * public profile: `{ orgId, name?, geoAreaCode?, description?, orgType?, contactEmail?, website?, focusStep?, focusPeriod? }`.
 * A null `geoAreaCode` takes the org out of its area; a null or blank profile field
 * clears it (a cleared `focusStep` leaves the focus to be derived from the org's data). At least one field besides the id is required.
 */
export async function PUT(request: NextRequest) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    readJsonObject(request),
    serveTea("api"),
  ]);

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }
  const accessContext = await getAccessContextFor(session.user);
  if (!accessContext) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!body) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  // undefined leaves the area alone, null (or an empty code) clears it
  const geoAreaCode = body.geoAreaCode === undefined ? undefined : (typeof body.geoAreaCode === 'string' && body.geoAreaCode ? body.geoAreaCode : null);
  const profile = parseOrgProfile(body);
  const hasProfile = profile.ok && Object.keys(profile.fields).length > 0;
  if (!body.orgId || typeof body.orgId !== 'string' || (!name && geoAreaCode === undefined && profile.ok && !hasProfile) || (body.name !== undefined && !name)) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }
  if (!profile.ok) {
    const messages: Record<OrgProfileRejection, string> = {
      [OrgProfileRejection.Description]: t('api:org.invalid_description'),
      [OrgProfileRejection.OrgType]: t('api:org.invalid_org_type'),
      [OrgProfileRejection.ContactEmail]: t('api:org.invalid_contact_email'),
      [OrgProfileRejection.Website]: t('api:org.invalid_website'),
      [OrgProfileRejection.FocusStep]: t('api:org.invalid_focus_step'),
      [OrgProfileRejection.FocusPeriod]: t('api:org.invalid_focus_period'),
    };
    return Response.json({ message: messages[profile.rejection] },
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
        ...(profile.fields.description !== undefined ? { description: profile.fields.description } : {}),
        ...(profile.fields.orgType !== undefined ? { org_type: profile.fields.orgType } : {}),
        ...(profile.fields.contactEmail !== undefined ? { contact_email: profile.fields.contactEmail } : {}),
        ...(profile.fields.website !== undefined ? { website: profile.fields.website } : {}),
        ...(profile.fields.focusStep !== undefined ? { focus_step: profile.fields.focusStep } : {}),
        ...(profile.fields.focusPeriod !== undefined ? { focus_period: profile.fields.focusPeriod } : {}),
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

  return Response.json({ message: name ? t('api:org.renamed') : geoAreaCode !== undefined ? t('api:org.area_updated') : t('api:org.profile_updated') },
    { status: 200 },
  );
}
