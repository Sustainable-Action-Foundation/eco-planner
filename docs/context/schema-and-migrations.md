# Schema and migrations

Naming rules for models and fields are in [domain-model.md](domain-model.md#naming-in-the-schema).

## Changing the schema
- Every schema change is a real, timestamped migration: `yarn prisma migrate dev --name <slug>`.
- Never edit `prisma/migrations/0_init/migration.sql`. It is the baseline that existing databases have recorded as applied.
- `yarn prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` shows drift without applying anything.
- Each checkout has its own generated client. After pulling schema changes (or in a fresh worktree) run `yarn install` and `yarn prisma generate`; a stale client shows up as `Cannot read properties of undefined` on a model that was just added, or as type errors in `yarn lint`.
- A fresh development database: `yarn prisma migrate deploy`, then `yarn prisma db seed` if you want data.
- Agents do not run destructive Prisma commands (`--force-reset`, `migrate reset`) against any database; Prisma refuses them without explicit consent anyway. Ask the developer.

## Deploying schema changes
- Code must never reach a database that lacks the columns it selects: every query on that table then fails and listings look empty rather than broken. The production compose file therefore runs `prisma migrate deploy` as a `migrate` service that the app waits for; a failed migration aborts the deploy before the old container is replaced.
- The seed image resets the database from the schema (`db push --force-reset`) and seeds it. That is for test and staging stacks only.
- Destructive migrations (dropped columns) deserve a backup first.

## Schema details worth knowing
- Composite foreign keys carry `org_id` so that cross-org grants and group memberships cannot be represented; see [access-control.md](access-control.md).
- A data series fills one slot; unique keys cover the same column only, the rest is enforced in code (`src/lib/seriesInvariants.ts`).
- XOR parents (an attachment's action / goal / version) are enforced in the API.
- Config-like value lists that may change without a migration are plain strings validated in code (`LikeAspect`), not database enums.
- `GeoAreas.name` is indexed, not unique, because of the collation.
- Connection pool settings are read from the `DATABASE_URL` query string; see [`caching.md`](../../caching.md#database-pool).
- Fetch `DateRecords` with an explicit `orderBy`; row order is not guaranteed.

## Bulk writes
For imports, backfills and repairs of stored data:
- Write a script that does the planning with app code and can **emit SQL**: client-generated UUIDs, one transaction, idempotent where possible. Review the SQL, back up, then apply it. Examples: `scripts/prisma/backfill-action-origins.ts --sql`, `scripts/prisma/fill-national-historical.ts --sql`.
- Why SQL rather than the Prisma client over a slow link: interactive transactions through the MariaDB driver adapter were seen to leak statements outside the transaction under latency, with rows committing despite a rollback. A single SQL transaction has no such failure mode.
- Keep planning pure and unit-testable (`scripts/lib/`), separate from the script that talks to a database.
- Scripts default to a dry run or a report. A script that rewrites data requires an explicit flag, and the percent re-evaluation script additionally requires an environment variable confirming a backup (`scripts/maintenance/reevaluate-percent-series.ts`).
- Give scripts an explicit `.catch` that exits non-zero. Do not rely on unhandled rejections to fail the run.
- Rows written out of band are not seen by the app until its cache is flushed, and only a restart flushes the in-memory cache; see [`caching.md`](../../caching.md).
- Before repairing derived data, check why it looks wrong: a stored value that is off by a factor may be compensated inside its recipe.
