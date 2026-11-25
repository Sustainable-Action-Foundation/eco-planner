# Access control

## The ladder
Implemented twice and kept in sync: per item in `src/lib/accessChecker.ts`, as Prisma filters in `src/lib/accessFilters.ts` (`readableAccessControlWHERE`, `visible*WHERE`, `editable*WHERE`).

1. Super admin: admin everywhere. A super admin can suspend their own powers; `session.user.isSuperAdmin` is the effective value.
2. `MANAGER` of the owning org: admin on everything the org owns, including sharing settings and group management.
3. `RW` grant through a group: edit content. **Not** sharing settings.
4. `RO` grant, `ORG` sharing (proper members only) or `PUBLIC` sharing: view.
5. A `DRAFT` version is visible only with edit access or better.

Why sharing is manager-only: if an RW grant could change sharing, any editor of a low-profile roadmap could publish it.

Commenting needs view access and a signed-in user; no grant is needed on public content (`hasCommentAccess`).

## Where access lives
- `AccessControls` hangs off the **roadmap only**. Versions, goals, effects and versioned actions inherit it. There are no per-version access controls, which rules out a public version under a private roadmap.
- `AccessControls.org_id` is the owning org. `AccessGrants` pairs an access control with a group at level `RO` or `RW`.
- Actions are org-owned (`Actions.org_id`). Without a version they are the shared, world-readable action database.
- Data series have no access control. Their visibility is derived from the goal or effect they belong to (`visibleDataSeriesWHERE`). A series derived from another org's series belongs to the deriving org; if access to the source is later revoked, the stored copy stays.

## Orgs, groups, memberships
- `OrgMemberships` (user + org, role `GUEST` / `MEMBER` / `MANAGER`). Managers are deliberately coarse until usage demands finer roles.
- `GroupMemberships` references the org membership and the group through composite keys that both carry `org_id`. A group membership across orgs cannot be represented, and leaving an org cascades away every group membership in it.
- `AccessGrants` uses the same trick: the group and the access control must share `org_id`, so a grant to another org's group cannot exist in the database. That is why matching on group id alone is safe in the checker.
- There is no "everyone" group. `Sharing.ORG` gives every proper member read access; a low-profile roadmap is `Sharing.GROUPS` plus an RW grant to the working group.
- New accounts join an org by e-mail domain (`src/lib/enrollment.ts`, `src/lib/allowedDomains.ts`).
- Managers manage members, groups and the org's geo area at `/org/[orgId]/groups` (`getOrgManagement` returns null for non-managers).

## The access context
- `getUserAccessContext()` (`src/fetchers/getUserAccessContext.ts`) returns the user's id, super admin flag and memberships with roles and group ids. It is memoized per request with React `cache()`.
- Cached readers take it as an argument, so it is part of every cache key: membership and role changes need no revalidation. See [caching-and-navigation.md](caching-and-navigation.md).

## Guests are disabled
`GUEST` is meant for cross-org contributors: no `ORG` read access, only what their groups grant plus public content. The whole feature is switched off until further notice:
- `getUserAccessContext` drops `GUEST` memberships at the root, so a lingering row grants nothing.
- The invite API and page answer 404; the invite UI is commented out.
- Every such site is marked with the comment "disabled until further notice". Search for it to restore the feature.

## Writes that link to other content
- `/api/goal` refuses a recipe that reads a data series the user cannot read (`assertReadableLinkedSeries`, 403 `IllegalSource`).
- A data series fills at most one slot (a goal's series, baseline or historical, or an effect's series). The unique keys only cover the same column; cross-slot reuse is prevented in code by `src/lib/seriesInvariants.ts`.

## Deletion
- There is no API for deleting an org. In the schema everything an org owns cascades from it, so deleting an org row deletes its content.
- A recipe cannot be deleted while a data series uses it. Orphan cleanup after deletes is `src/functions/pruneOrphans.ts`.

## Direction, not yet in code
- Institution-scale read access for another org (a reader-org list on the access control, read-only to start) is an open question. Today cross-org access is `PUBLIC` sharing or nothing.
