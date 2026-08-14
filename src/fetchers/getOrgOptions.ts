import "server-only";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";

export type OrgOption = {
  id: string,
  name: string,
  /** The requesting user's role in the org (super admins get MANAGER everywhere) */
  role: OrgRole,
  groups: { id: string, name: string }[],
  /** Ids of the org's groups the requesting user belongs to (e.g. to warn before losing edit access) */
  userGroupIds: string[],
};

/**
 * The orgs the requesting user can create content in (non-guest memberships;
 * super admins get every org), with each org's groups for the grant editor.
 * Uncached, like the access context it derives from.
 */
export async function getOrgOptions(): Promise<OrgOption[]> {
  const accessContext = await getUserAccessContext();
  if (!accessContext) {
    return [];
  }

  try {
    const orgs = await prisma.orgs.findMany({
      where: accessContext.isSuperAdmin
        ? {}
        : { id: { in: accessContext.memberships.filter(m => m.role !== OrgRole.GUEST).map(m => m.orgId) } },
      select: {
        id: true,
        name: true,
        groups: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return orgs.map(org => ({
      id: org.id,
      name: org.name,
      role: accessContext.isSuperAdmin
        ? OrgRole.MANAGER
        : accessContext.memberships.find(m => m.orgId === org.id)?.role ?? OrgRole.MEMBER,
      groups: org.groups,
      userGroupIds: accessContext.memberships.find(m => m.orgId === org.id)?.groupIds ?? [],
    }));
  }
  catch (err) {
    console.error("Error fetching org options", { err });
    return [];
  }
}
