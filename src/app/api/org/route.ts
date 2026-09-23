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

// Org management: org managers (and super admins) rename their org. Org names
// are unique, and the DB constraint is the source of truth for collisions (no
// racy pre-check). Cached payloads carry org names (see getUserOrgs), so a
// rename revalidates the 'org' tag.

function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
  return accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
}

/** Renames an org the requester manages */
export async function PUT(request: NextRequest) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ orgId?: string, name?: string }>,
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
  if (!body.orgId || typeof body.orgId !== 'string' || !name) {
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

  try {
    await prisma.orgs.update({
      where: { id: org.id },
      data: { name },
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

  return Response.json({ message: t('api:org.renamed') },
    { status: 200 },
  );
}
