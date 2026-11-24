# Actions

## Ownership and visibility
- An action belongs to an org (`Actions.org_id`). With a roadmap version it follows that roadmap's access; without one it is part of the shared action database: world-readable, edited by the owning org's managers. The action page says so in a note.
- Filters: `visibleActionsWHERE` and `editableActionsWHERE` in `src/lib/accessFilters.ts`.
- `/actions` and the org landing list slim summaries (`getActionSummaries`), not full actions.

## Fields
- Actions have no fixed descriptive columns. Everything descriptive is an `ActionFields` row: `header`, `value`, `type` (`ActionFieldType`: paragraph, date, short) and an order.
- List-ness is structural: several fields under one header collapse into a list when the type allows it.
- Only two headers are canonical and get special handling: `DESCRIPTION` and `TAG` (`ActionFieldHeaders` in `src/functions/fields.ts`). Every other header is user text and renders verbatim.
- Helpers for grouping, labels and defaults are in `src/functions/fields.ts`.
- Goals do not use this model; see the standing decision in [domain-model.md](domain-model.md).

## Origins and neighbours
The same action often exists in several orgs, for example a municipality's catalogue entry and the copies held by each responsible committee or company.
- `Actions.origin_action_id` links a copy to its original. The original is a real action owned by an org, typically the municipality-level one. An ownerless identity table was considered and rejected in favour of owned originals.
- One level only: an origin never has an origin. The API (`originActionId` on `/api/action`) resolves a link to a copy into that copy's origin, refuses self-links, and refuses to turn an action that already has copies into a copy.
- `parent_action_id` is something else: version inheritance within a roadmap. Do not reuse it for copies.
- Linked actions are "neighbours" ("Grannåtgärder") in the UI. `getActionNeighbours` (`src/fetchers/getActionNeighbours.ts`) lists the original and the other copies the viewer may see.
- A drift marker shows when a copy's content differs from its original (`actionContentDiffers`): name, years, or a field group present on the copy. Headers only the original carries are extra information there, not drift.
- Why: an org wants to see who else has the same action and to keep wording in step. Copies may still diverge on purpose.

## Importing a municipality's actions
The shape that imports follow:
- One org per responsible body ("ansvarig"), each tied to the municipality's geo area. Responsibility is expressed by org ownership, not by a field on the action.
- An action with several responsible bodies becomes one copy per body. The duplication is intended.
- A municipality-level org owns the originals, and the originals carry the list of responsible bodies back as fields.
- `scripts/prisma/backfill-action-origins.ts` (planner in `scripts/lib/actionOrigins.ts`) clusters existing copies by the catalogue's own action number, creates the originals and links the copies. It is idempotent, can emit SQL for one transaction (`--sql`), and takes a list of municipality configs to extend for the next import.
- Bulk writes follow the pattern in [schema-and-migrations.md](schema-and-migrations.md#bulk-writes).

## Direction, not yet in code
- Offering to sync a copy from its original, and "copy to my org" from the action page.
