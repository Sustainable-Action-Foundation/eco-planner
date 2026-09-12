/**
 * Backfills action origins for municipal catalogues that were split into per-responsible org copies.
 *
 * For every (municipality, catalogue number) group of roadmapless copies it recreates the source row
 * as an original owned by the municipality's umbrella org ("Uppsala", "Enköping"; created if missing),
 * writes the responsible orgs back onto the original as fields, and points every copy at it through
 * `Actions.origin_action_id`. Copies that already have an origin, or are origins themselves, are skipped,
 * so re-running after manual links is safe.
 *
 * Usage (reads DATABASE_URL, e.g. a locally restored prod dump; the react-server condition
 * turns the prisma module's server-only import into a no-op, as for the seed):
 *   yarn tsx --conditions=react-server scripts/prisma/backfill-action-origins.ts                  # markdown report on stdout, writes nothing
 *   yarn tsx --conditions=react-server scripts/prisma/backfill-action-origins.ts --sql > out.sql  # one transaction to run on the target db
 *   --clusters-only   skip catalogue rows that only have a single copy
 *
 * The SQL route exists because bulk prod writes go over ssh as generated SQL (see the prod runbook).
 */
import { prisma } from "@/lib/prisma";
import { municipalities, originPlanToReport, originPlanToSql, planActionOrigins } from "../lib/actionOrigins";

async function main() {
  const args = process.argv.slice(2);
  const emitSql = args.includes("--sql");
  const clustersOnly = args.includes("--clusters-only");

  const [copies, orgs] = await Promise.all([
    prisma.actions.findMany({
      where: {
        roadmap_iteration_id: null,
        origin_action_id: null,
        derived_actions: { none: {} },
        org: { geo_area_code: { in: municipalities.map(municipality => municipality.geoAreaCode) } },
      },
      select: {
        id: true,
        name: true,
        indicator_parameter: true,
        start_year: true,
        end_year: true,
        created_at: true,
        author_id: true,
        org: { select: { id: true, name: true, geo_area_code: true } },
        fields: { select: { header: true, value: true, type: true, order: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.orgs.findMany({ select: { id: true, name: true, geo_area_code: true } }),
  ]);

  const plan = planActionOrigins(copies, orgs, municipalities, { clustersOnly });
  process.stdout.write(emitSql ? originPlanToSql(plan) : originPlanToReport(plan, municipalities));
}

// @/lib/prisma installs an uncaughtException handler that would swallow failures and exit 0
main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
