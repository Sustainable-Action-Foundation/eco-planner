// DO NOT SEED PRODUCTION DATABASE

import { colors } from "../src/scripts/lib/colors";
import { PrismaClient, RoadmapType } from '@prisma/client';
import bcrypt from "bcryptjs";
import { LoremIpsum } from "lorem-ipsum";

const prisma = new PrismaClient();
prisma.$connect().catch((e) => {
  console.error(colors.yellow(`
    Could not connect to the database. Ensure DATABASE_URL is set correctly in the .env file.

    Error thrown:
    `), e);
  process.exit(1);
});
const lorem = new LoremIpsum();

async function main() {
  // TODO: We should consider adding more types of data to the seed, see the list below.
  // - More roadmaps and meta roadmaps
  // - Inheritance between meta roadmaps, roadmaps, goals (combined goals), and actions
  // - Links
  // - Notes?
  // - User groups?

  const hashedPassword = await bcrypt.hash('admin', 10);

  // A user with admin rights, username and password 'admin'
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      isAdmin: true,
      isVerified: true,
      email: 'admin@admin.admin',
    }
  })

  const mainMetaRoadmap = await prisma.metaRoadmap.create({
    data: {
      name: 'Main Meta Roadmap',
      description: 'This is the main meta roadmap created for testing',
      type: RoadmapType.NATIONAL,
      actor: 'Sverige',
      authorId: admin.id,
      isPublic: true,
    }
  });

  const mainRoadmap = await prisma.roadmap.create({
    data: {
      description: 'This is the main roadmap created for testing',
      version: 1,
      authorId: admin.id,
      isPublic: true,
      metaRoadmapId: mainMetaRoadmap.id,
    }
  });

  // We use prisma.$transaction instead of prisma.goal.createManyAndReturn as it allows
  // nested data creation, which is necessary for creating data series for each goal.
  const goals = await prisma.$transaction(Array(10).fill(null).map((_) => (
    prisma.goal.create({
      data: {
        name: lorem.generateWords(3),
        description: lorem.generateSentences(3),
        indicatorParameter: lorem.generateWords(5).replace(/\s/g, '\\'),
        isFeatured: Math.random() > 0.7,
        // TODO: Add external data to some goals
        authorId: admin.id,
        roadmapId: mainRoadmap.id,
        // Random data series for each goal
        dataSeries: {
          create: {
            // TODO: Add more possible units
            unit: 's',
            val2020: Math.random() * 100,
            val2021: Math.random() * 100,
            val2022: Math.random() * 100,
            val2023: Math.random() * 100,
            val2024: Math.random() * 100,
            val2025: Math.random() * 100,
            val2026: Math.random() * 100,
            val2027: Math.random() * 100,
            val2028: Math.random() * 100,
            val2029: Math.random() * 100,
            val2030: Math.random() * 100,
            val2031: Math.random() * 100,
            val2032: Math.random() * 100,
            val2033: Math.random() * 100,
            val2034: Math.random() * 100,
            val2035: Math.random() * 100,
            val2036: Math.random() * 100,
            val2037: Math.random() * 100,
            val2038: Math.random() * 100,
            val2039: Math.random() * 100,
            val2040: Math.random() * 100,
            val2041: Math.random() * 100,
            val2042: Math.random() * 100,
            val2043: Math.random() * 100,
            val2044: Math.random() * 100,
            val2045: Math.random() * 100,
            val2046: Math.random() * 100,
            val2047: Math.random() * 100,
            val2048: Math.random() * 100,
            val2049: Math.random() * 100,
            val2050: Math.random() * 100,
            authorId: admin.id,
          }
        }
      },
      include: {
        dataSeries: true,
      }
    })
  )));

  const actions = await prisma.$transaction(Array(10).fill(null).map((_) => (
    prisma.action.create({
      data: {
        name: lorem.generateWords(3),
        description: lorem.generateSentences(3),
        startYear: 2020 + Math.round(Math.random() * 10),
        endYear: 2050 - Math.round(Math.random() * 10),
        costEfficiency: lorem.generateWords(1),
        expectedOutcome: lorem.generateSentences(1),
        projectManager: lorem.generateWords(2),
        relevantActors: lorem.generateSentences(1).replace(" ", ", "),
        isSufficiency: Math.random() > 0.7,
        isEfficiency: Math.random() > 0.7,
        isRenewables: Math.random() > 0.7,
        authorId: admin.id,
        roadmapId: mainRoadmap.id,
        effects: {
          create: [
            {
              dataSeries: {
                create: {
                  unit: '',
                  val2020: Math.random() * 100,
                  val2021: Math.random() * 100,
                  val2022: Math.random() * 100,
                  val2023: Math.random() * 100,
                  val2024: Math.random() * 100,
                  val2025: Math.random() * 100,
                  val2026: Math.random() * 100,
                  val2027: Math.random() * 100,
                  val2028: Math.random() * 100,
                  val2029: Math.random() * 100,
                  val2030: Math.random() * 100,
                  val2031: Math.random() * 100,
                  val2032: Math.random() * 100,
                  val2033: Math.random() * 100,
                  val2034: Math.random() * 100,
                  val2035: Math.random() * 100,
                  val2036: Math.random() * 100,
                  val2037: Math.random() * 100,
                  val2038: Math.random() * 100,
                  val2039: Math.random() * 100,
                  val2040: Math.random() * 100,
                  val2041: Math.random() * 100,
                  val2042: Math.random() * 100,
                  val2043: Math.random() * 100,
                  val2044: Math.random() * 100,
                  val2045: Math.random() * 100,
                  val2046: Math.random() * 100,
                  val2047: Math.random() * 100,
                  val2048: Math.random() * 100,
                  val2049: Math.random() * 100,
                  val2050: Math.random() * 100,
                  authorId: admin.id,
                }
              },
              // Assign to goal 0, 1, or 2 (Math.random() is always < 1)
              goalId: goals[Math.floor(Math.random() * 3)]?.id,
            },
            {
              dataSeries: {
                create: {
                  unit: '',
                  val2020: Math.random() * 100,
                  val2021: Math.random() * 100,
                  val2022: Math.random() * 100,
                  val2023: Math.random() * 100,
                  val2024: Math.random() * 100,
                  val2025: Math.random() * 100,
                  val2026: Math.random() * 100,
                  val2027: Math.random() * 100,
                  val2028: Math.random() * 100,
                  val2029: Math.random() * 100,
                  val2030: Math.random() * 100,
                  val2031: Math.random() * 100,
                  val2032: Math.random() * 100,
                  val2033: Math.random() * 100,
                  val2034: Math.random() * 100,
                  val2035: Math.random() * 100,
                  val2036: Math.random() * 100,
                  val2037: Math.random() * 100,
                  val2038: Math.random() * 100,
                  val2039: Math.random() * 100,
                  val2040: Math.random() * 100,
                  val2041: Math.random() * 100,
                  val2042: Math.random() * 100,
                  val2043: Math.random() * 100,
                  val2044: Math.random() * 100,
                  val2045: Math.random() * 100,
                  val2046: Math.random() * 100,
                  val2047: Math.random() * 100,
                  val2048: Math.random() * 100,
                  val2049: Math.random() * 100,
                  val2050: Math.random() * 100,
                  authorId: admin.id,
                }
              },
              // Assign to goal 3, 4, or 5
              goalId: goals[Math.floor(Math.random() * 3) + 3]?.id,
            },
            {
              dataSeries: {
                create: {
                  unit: '',
                  val2020: Math.random() * 100,
                  val2021: Math.random() * 100,
                  val2022: Math.random() * 100,
                  val2023: Math.random() * 100,
                  val2024: Math.random() * 100,
                  val2025: Math.random() * 100,
                  val2026: Math.random() * 100,
                  val2027: Math.random() * 100,
                  val2028: Math.random() * 100,
                  val2029: Math.random() * 100,
                  val2030: Math.random() * 100,
                  val2031: Math.random() * 100,
                  val2032: Math.random() * 100,
                  val2033: Math.random() * 100,
                  val2034: Math.random() * 100,
                  val2035: Math.random() * 100,
                  val2036: Math.random() * 100,
                  val2037: Math.random() * 100,
                  val2038: Math.random() * 100,
                  val2039: Math.random() * 100,
                  val2040: Math.random() * 100,
                  val2041: Math.random() * 100,
                  val2042: Math.random() * 100,
                  val2043: Math.random() * 100,
                  val2044: Math.random() * 100,
                  val2045: Math.random() * 100,
                  val2046: Math.random() * 100,
                  val2047: Math.random() * 100,
                  val2048: Math.random() * 100,
                  val2049: Math.random() * 100,
                  val2050: Math.random() * 100,
                  authorId: admin.id,
                }
              },
              // Assign to goal 6, 7, 8, or 9
              goalId: goals[Math.floor(Math.random() * 4) + 6]?.id,
            }
          ],
        }
      },
      include: {
        effects: {
          include: {
            dataSeries: true,
          }
        }
      }
    })
  )));

  const users = await prisma.$transaction(Array(5).fill(null).map((_, index) => (
    prisma.user.create({
      data: {
        username: `${lorem.generateWords(1)}-${index}`,
        password: hashedPassword,
        email: `${lorem.generateWords(2).replace(" ", ".")}+${index}@example.com`,
        isAdmin: false,
        isVerified: true,
      }
    })
  )));

  const _comments = await prisma.$transaction(Array(30).fill(null).map((_) => {
    const commentType = Math.random();
    return prisma.comment.create({
      data: {
        commentText: lorem.generateParagraphs(1),
        authorId: users[Math.floor(Math.random() * users.length)]?.id,
        metaRoadmapId: commentType < 0.15 ? mainMetaRoadmap.id : null,
        roadmapId: commentType >= 0.15 && commentType < 0.3 ? mainRoadmap.id : null,
        goalId: commentType >= 0.3 && commentType < 0.65 ? goals[Math.floor(Math.random() * goals.length)]?.id : null,
        actionId: commentType >= 0.65 ? actions[Math.floor(Math.random() * actions.length)]?.id : null,
      }
    })
  }));
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(colors.yellow(`
    Error found while seeding.

    - Do you have a valid database connection?
    - Is the database empty?

    This seed script must run against an empty database.

    Error thrown:
    `), e);
  await prisma.$disconnect();
  process.exit(1)
});