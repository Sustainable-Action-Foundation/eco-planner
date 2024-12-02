import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // TODO: Do stuff here to seed the database for testing/development
  // Stuff to create:
  // - Admin user
  // - Meta roadmap
  // - Roadmap
  // - Goals w/ data series
  // - Actions
  // - Effects w/ data series
  // Optionally also:
  // - More users and roadmaps
  // - Inheritance between roadmaps, goals (combined goals) and actions
  // - Comments
  // - Links
  // - Notes?
  // - User groups?
  return;
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1)
});