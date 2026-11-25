/**
 * Rewrites stored recipes whose variables carry a `type` spelling from before a rename
 * (`legacyRecipeDataTypes` in src/functions/recipe/legacyTypes.ts) to the current spelling.
 *
 * Background: `RecipeDataTypes.DataSeries` was "dataSeries" until 2026-07-30 and is "data-series"
 * since. Stored recipes were not rewritten, and the SQL that gave every recipe-less series an inline
 * manual recipe when the database was levelled wrote "dataSeries" literally, so those recipes failed
 * the type guard ("Invalid object format for formula"). The app now accepts the old spelling when it
 * reads (`Recipe.from`); this script makes the stored rows current.
 *
 * Only the `type` of the affected variables changes; values, units and DateRecords are not touched.
 * Rows that would still not parse after the rewrite are listed and left alone.
 *
 * Usage (reads DATABASE_URL from .env; writes nothing unless --apply):
 *   yarn tsx scripts/maintenance/rewrite-legacy-recipe-types.ts                  # counts on stdout
 *   yarn tsx scripts/maintenance/rewrite-legacy-recipe-types.ts --sql > out.sql  # one transaction to review and run on the target db
 *   LEGACY_TYPES_I_HAVE_A_BACKUP=1 yarn tsx scripts/maintenance/rewrite-legacy-recipe-types.ts --apply
 *
 * `--apply` runs one guarded UPDATE per recipe (no transaction: each is independent, and a row saved
 * since the scan is skipped), so it can be interrupted and re-run. It refuses to run unless
 * LEGACY_TYPES_I_HAVE_A_BACKUP=1 is set (a tunnelled server database looks local too).
 *
 * The app reads both spellings, so no restart is needed for correctness; cached readers simply keep
 * the old text until they are next invalidated.
 */
import "dotenv/config";
// Standalone script: its own client (no next-only imports, no query-event logging), as @/lib/prisma builds it
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { PrismaClient } from "../../prisma/generated/client";
import { makeMariaDBAdapter } from "@/lib/prisma/mariadb-adapter";
import { legacyTypePlanToReport, legacyTypePlanToSql, planLegacyTypeRewrites } from "../lib/legacyRecipeTypes";
import type { StoredRecipe } from "../lib/legacyRecipeTypes";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const emitSql = args.includes("--sql");
if (apply && emitSql) {
  console.error("Use either --sql or --apply, not both.");
  process.exit(2);
}

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not defined");
// A tunnelled production database also answers on 127.0.0.1, so the host name cannot tell
// local from remote: --apply always needs the explicit backup flag, and the target is printed.
const dbUrl = new URL(DATABASE_URL);
const dbTarget = `${dbUrl.hostname}:${dbUrl.port || "3306"}${dbUrl.pathname}`;
// With --sql, stdout is the SQL file: everything for the human goes to stderr
const say = (text: string) => { (emitSql ? process.stderr : process.stdout).write(text.endsWith("\n") ? text : `${text}\n`); };
say(`${apply ? "APPLYING to" : "Dry run against"} ${dbTarget}`);
if (apply && process.env.LEGACY_TYPES_I_HAVE_A_BACKUP !== "1") {
  console.error(`Refusing --apply against ${dbTarget}: take a fresh backup first, then set LEGACY_TYPES_I_HAVE_A_BACKUP=1.`);
  process.exit(2);
}

const prisma = new PrismaClient(makeMariaDBAdapter(DATABASE_URL));

async function main() {
  // As text, so the guarded write can compare against exactly what was read
  const rows = await prisma.$queryRaw<StoredRecipe[]>`SELECT \`id\`, CAST(\`recipe\` AS CHAR) AS \`raw\` FROM \`Recipes\``;

  // The type guards explain every rejection with a dump of the object; the plan carries the reasons instead
  const warn = console.warn;
  console.warn = () => undefined;
  const plan = planLegacyTypeRewrites(rows);
  console.warn = warn;

  say(legacyTypePlanToReport(plan));

  if (emitSql) {
    process.stdout.write(legacyTypePlanToSql(plan));
    say(`SQL for ${plan.rewrites.length} recipes written to stdout; nothing was written to the database.`);
    return;
  }
  if (!apply) {
    say(`Dry run: nothing written. --apply would rewrite ${plan.rewrites.length} recipes.`);
    return;
  }

  let rewritten = 0;
  let skipped = 0;
  for (const rewrite of plan.rewrites) {
    const affected = await prisma.$executeRaw`UPDATE \`Recipes\` SET \`recipe\` = ${rewrite.after} WHERE \`id\` = ${rewrite.id} AND \`recipe\` = ${rewrite.before}`;
    if (affected === 1) rewritten++;
    else skipped++;
  }
  say(`Written: ${rewritten} recipes rewritten, ${skipped} skipped (changed since the scan; run again to see what is left).`);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
