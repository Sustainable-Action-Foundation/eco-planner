# Domain model and vocabulary

The schema is the reference: [`prisma/schema.prisma`](../../prisma/schema.prisma). This file is the vocabulary around it.

## Entities
- **Roadmap** (`Roadmaps`): the top level, owned by an org, optionally tied to a geo area. Its page is a menu of versions, not a place to linger.
- **Roadmap version** (`RoadmapIterations`): the content level. Users say "version" ("färdplansversion"); code says "iteration" because "version" is too generic inside a codebase. Both words mean the same thing.
- **Goal** (`Goals`, "målbana"): a target trajectory in a version. It has up to three data series: the goal series, a baseline and historical data.
- **Action** (`Actions`, "åtgärd"): owned by an org, with or without a roadmap version. Actions without a version form the shared action database.
- **Effect** (`Effects`): the link between one action and one goal, with its own data series. It has no id of its own and no view page.
- **Data series and recipes**: see [data-series-and-recipes.md](data-series-and-recipes.md).
- **Orgs, groups, memberships, access controls**: see [access-control.md](access-control.md).
- **Geo areas** (`GeoAreas`): a static lookup keyed by SCB region code (`00` nation, 2-digit counties, 4-digit municipalities). Roadmaps and orgs point at one through `geo_area_code`. `name` is not unique on purpose: the database collation treats å and a as equal, so "Habo" and "Håbo" would collide.

## Naming in the schema
- No `@map` / `@@map`. Models are plural PascalCase and equal the table names; fields are snake_case and appear that way in the generated client.
- "Roadmap" always means the top level. The older words for the two levels are banned by ESLint (`eslint.config.ts`, the `meta_?roadmap` / `roadmap series` patterns).
- Only the `Prisma` namespace may be imported from the generated client; everything else comes from `@/lib/prisma/generated`.
- Authors (`author_id`) are cosmetic everywhere, nullable with `SetNull`, so users can be deleted. They never grant access.

## Visibility vocabulary
Three single-valued settings, one per level, no booleans:

| Level | Enum | Values | Means |
| --- | --- | --- | --- |
| Roadmap (`AccessControls.sharing`) | `Sharing` | `GROUPS` / `ORG` / `PUBLIC` | who may read the roadmap and everything under it |
| Version (`RoadmapIterations.status`) | `IterationStatus` | `DRAFT` / `PUBLISHED` | a draft is a hard gate: only editors see it |
| Goal (`Goals.listing`) | `GoalListing` | `LISTED` / `UNLISTED` / `FEATURED` | listing only, never access |

- Words, in both locales: **Sharing / Delning**, **Status**, **Listing / Listning**. "Public / Publik" is reserved for sharing. Versions are "Published / Publicerad". Goals are "Listed / Synlig"; unlisted is "Dold".
- There is deliberately no unlisted tier for versions: hiding things should not be encouraged, and a working area is a draft. `published_at` is only an informational "first published" timestamp.
- `Roadmaps.hidden` leaves a roadmap out of listings and pickers but never affects access.
- Listing decisions go through `src/lib/listing.ts` (`isGoalListed`, `isRoadmapListed`) and, on the query side, `listedGoalsWHERE` / `listedRoadmapsWHERE` in `src/lib/accessFilters.ts`.
- State is shown with `src/components/generic/visibility/visibilityBadges.tsx` and `sharingLine.tsx`. Don't hand-roll badges.
- Actions without a version are world-readable regardless of any sharing, and editable by the owning org's managers.

## Goal names
Most goals have no `name` and go by the last part of their indicator parameter. Use `goalDisplayName` and `normalizeGoalName` from `src/functions/goalName.ts`; treat `""` and `null` alike. The edit form shows the fallback as a placeholder and the API stores a blank name as `null`: the fallback is never stored as a name.

## Routes
- URL segments are kebab-case. Prefer nesting over compound names.
- Versions nest under roadmaps: `/roadmap/[roadmapId]/v{n}` or `/latest` (latest published), `.../edit`, and `/roadmap/[roadmapId]/iteration/create`. `/roadmap/[roadmapId]/iteration/[iterationId]` redirects to the canonical slug. Always build these links with `iterationPath` from `src/functions/versionSlug.ts`.
- Effects are addressed by both ids: `/effect/[actionId]/[goalId]/edit`.
- `/api/roadmap-iteration` is deliberately separate from `/api/roadmap`.

## Swedish terminology
- Swedish is the product language. English exists because the team knows it.
- Org managers (`OrgRole.MANAGER`) are "ansvarig / ansvariga", never "chef": the role is not a line manager.
- Before inventing a Swedish term, search `public/locales/sv-SE` for how the concept is already named and reuse it.
- Linked copies of an action are "Grannåtgärder" (neighbours); "siblings" is taken by goals in the same version.

## Standing product decisions
- Guests (cross-org contributors) are disabled until further notice; see [access-control.md](access-control.md).
- Goal tags stay as `GoalTags`. Generalising them into typed fields like `ActionFields` is deliberately not done. If it is resumed, the agreed shape is "split the domain, share the plumbing": separate tables and per-entity headers, shared field type enum, editor components and grouping helpers.
- A national roadmap is a one-time starting seed for local roadmaps, not something that is re-imported.
