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
- What a series was computed from does not come with it. A recipe's source series (`Recipes.source_data_series`: a copied goal's series, an inherited baseline) follow their own goal or effect, so a public copy of a goal under a closed roadmap or in a draft shows its own values and nothing of the original (`visibleSourceSeriesWHERE`).
  - Filtered in the query: every selection in `src/fetchers/inclusionSelectors.ts` that carries a series' recipe narrows `source_data_series` with it.
  - The recipe itself names what it reads (the source's series id, and the copied goal's name as the variable's label and in the equation) and is one JSON value, so the readers finish the job: `withoutHiddenSources` (`src/fetchers/hiddenSources.ts`) replaces a recipe that reads a series the viewer did not get with an empty one before the cached reader returns. `tests/unit/source-selections.test.ts` fails on a selection or a reader that skips either step.
  - A source that fills no slot (statistics fetched for a recipe, or what a deleted goal left behind for the recipes still reading it) has no visibility of its own. It goes only to those who may edit a series computed from it, because the edit forms evaluate from it; a recipe that only reads fetched statistics is not emptied for the others, since the source line under the graph reads it.
  - Edit access to the computed goal gives nothing on a source the editor cannot see: no values, an empty recipe in the form, and no recalculation. The gap this leaves in the form is described in [goal-api-and-forms.md](goal-api-and-forms.md#guards-in-the-route).
- An effect is visible only to those who may see **both** its action and its goal (`visibleEffectsWHERE`). The two can sit under different roadmaps or versions (a draft's action on a published goal, a shared-database action on a goal of a closed roadmap), and creating an effect takes edit access to both, so the state is ordinary.
  - Whoever sees only one side does not get the effect at all: no row, no series, nothing of the other side. It is filtered in the query, never in the page. Every selection in `src/fetchers/inclusionSelectors.ts` that reaches effects through a goal or an action is a function of the access context for that reason; `tests/unit/effect-selections.test.ts` fails on an `effects` without the filter.
  - Counts follow the same filter (`_count.effects` in lists, the org landing's "goals with actions").
  - The goal page alone says how many effects it leaves out (`hidden_effect_count` from `getOneGoal`, a note above the lists), because its expected outcome is computed from the effects shown. Nothing but the number is known there. This holds for editors of the goal too: edit access to the goal gives nothing on an action they cannot see.

## Orgs, groups, memberships
- `OrgMemberships` (user + org, role `GUEST` / `MEMBER` / `MANAGER`). Managers are deliberately coarse until usage demands finer roles.
- `GroupMemberships` references the org membership and the group through composite keys that both carry `org_id`. A group membership across orgs cannot be represented, and leaving an org cascades away every group membership in it.
- `AccessGrants` uses the same trick: the group and the access control must share `org_id`, so a grant to another org's group cannot exist in the database. That is why matching on group id alone is safe in the checker.
- There is no "everyone" group. `Sharing.ORG` gives every proper member read access; a low-profile roadmap is `Sharing.GROUPS` plus an RW grant to the working group.
- New accounts join an org by e-mail domain (`src/lib/enrollment.ts`, `src/lib/allowedDomains.ts`). That happens once, when the account is created: a later login never adds or removes a membership, so a membership set by hand stays.
- Managers manage members, member roles, groups and the org's geo area at `/org/[orgId]/groups` (`getOrgManagement` returns null for non-managers).

### Who the members are
Changed on the same page through `/api/org-membership` (POST add, DELETE remove, PATCH move). One function per action in `src/functions/orgMembership.ts` decides, for the API and for the page (`getOrgMemberAdmin`) alike:

| | Manager ("ansvarig") of the org | Super admin, powers on | Anyone else |
| --- | --- | --- | --- |
| Add an existing user | by exact e-mail address | also from the list of every user | no (403) |
| Remove a member | anyone but themselves | anyone | no (404) |
| Move a member to another org | only to an org they also manage, never themselves | anyone, to any org | no (404) |
| See every user and address | no | yes | no |
| Change a role (PUT) | anyone but themselves | anyone but themselves | no (404) |

- A super admin with suspended powers is whatever their memberships make them: the manager of the orgs they manage.
- **Managers never get the user list or anyone's address.** They type an exact address and the server answers for that one: 201, "already a member" (409) or "no account with that address" (404). That last answer tells whether an account exists; it is accepted from a signed-in manager and bounded by a per-manager rate limit (`memberLookupRate`, 429 past it).
- A move is one transaction: a membership is created in the other org and the old one deleted. The role comes along unless another is given; group memberships cannot, since groups belong to one org.
- Nothing an org owns depends on a member, so removing one orphans nothing. An org may be left without a manager (the page warns, nothing blocks): super admins then administer it. Managers cannot take themselves out, so an org does not lose its last manager by a slip of its own.
- No session is touched. The access context is read per request, so the change applies on the user's next request.
- On the page the manager's part is one box in the manager yellow and what only the powers add (the user list, moving to any org) a second box in the super-admin orange.

## The access context
- `getUserAccessContext()` (`src/fetchers/getUserAccessContext.ts`) returns the user's id, super admin flag and memberships with roles and group ids. It is memoized per request with React `cache()`.
- Cached readers take it as an argument, so it is part of every cache key: membership and role changes need no revalidation. See [caching-and-navigation.md](caching-and-navigation.md).

## Role colours
- Yellow (`--admin-*` in `src/styles/colors.css`) marks what a role in the owning org gives: the admin panel on roadmap, version, goal and action pages.
- Orange (`--super-admin-*`) marks super-admin powers: the switch on the profile page, the sidebar's account button while the powers are off, and an admin panel the user has only through the powers (`isSuperAdminAccess` in `src/lib/accessChecker.ts`). A super admin who also manages the owning org gets the yellow panel there.
- Red stays for deleting and errors, so the super-admin colour stops short of it.

## Guests are disabled
`GUEST` is meant for cross-org contributors: no `ORG` read access, only what their groups grant plus public content. The whole feature is switched off until further notice:
- `getUserAccessContext` drops `GUEST` memberships at the root, so a lingering row grants nothing.
- The invite API and page answer 404; the invite UI is commented out.
- Every such site is marked with the comment "disabled until further notice". Search for it to restore the feature.

## Writes that link to other content
- `/api/goal` refuses a recipe that reads a data series the user cannot read (`assertReadableLinkedSeries`, 403 `IllegalSource`).
- `/api/recalculate` refuses the same way when the stored recipe reads a series the user cannot read, before anything is evaluated: a series is recomputed from all of its sources or not at all.
- A data series fills at most one slot (a goal's series, baseline or historical, or an effect's series). The unique keys only cover the same column; cross-slot reuse is prevented in code by `src/lib/seriesInvariants.ts`.

## Deletion
- There is no API for deleting an org. In the schema everything an org owns cascades from it, so deleting an org row deletes its content.
- A recipe cannot be deleted while a data series uses it. Orphan cleanup after deletes is `src/functions/pruneOrphans.ts`.

## Direction, not yet in code
- Institution-scale read access for another org (a reader-org list on the access control, read-only to start) is an open question. Today cross-org access is `PUBLIC` sharing or nothing.
