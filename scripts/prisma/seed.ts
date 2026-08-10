// DO NOT SEED PRODUCTION DATABASE
//
// Entry point for seeding. This file only orchestrates: it connects, runs each
// seed module in dependency order (users -> roadmaps -> goals -> actions), and
// handles teardown/errors. The actual seed data and the shared helpers live in
// ./seed/*.
//
// The seed covers every table in the schema and leans on recipes for derived data
// (see ./seed/helpers.ts and ./seed/seed-goals.ts), matching the app's philosophy
// that data series are produced through recipes.

import { prisma } from "@/lib/prisma";
import { colors } from "../lib/colors.ts";
import { seedGeoAreas } from "./seed/seed-geo.ts";
import { seedUsers } from "./seed/seed-users.ts";
import { seedRoadmaps } from "./seed/seed-roadmaps.ts";
import { seedGoals } from "./seed/seed-goals.ts";
import { seedActions } from "./seed/seed-actions.ts";
import { seedExtraOrgs } from "./seed/seed-extra-orgs.ts";

prisma.$connect().catch((err: unknown) => {
  console.error(colors.yellow(`
    Could not connect to the database. Ensure DATABASE_URL is set correctly in the .env file.

    Error thrown:
    `), err);
  process.exit(1);
});

async function main() {
  await seedGeoAreas();
  const users = await seedUsers();
  const { iterations } = await seedRoadmaps(users);
  const goals = await seedGoals(users, iterations);
  await seedActions(users, iterations, goals);
  await seedExtraOrgs(users);
}

main().then(async () => {
  console.info(colors.green("Seeding complete."));
  await prisma.$disconnect();
}).catch(async (err: unknown) => {
  console.error(colors.yellow(`
    Error found while seeding.

    - Do you have a valid database connection?
    - Is the database empty?

    This seed script must run against an empty database.

    Error thrown:
    `), err);
  await prisma.$disconnect();
  process.exit(1);
});
