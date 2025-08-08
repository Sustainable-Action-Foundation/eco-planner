// DO NOT SEED PRODUCTION DATABASE

import { colors } from "../src/scripts/lib/colors";
import { PrismaClient, RoadmapType } from '../src/prisma/generated';
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { RandomTextSE } from "./randomText";
import { dataSeriesDataFieldNames } from "@/types";

const prisma = new PrismaClient();
prisma.$connect().catch((e) => {
  console.error(colors.yellow(`
    Could not connect to the database. Ensure DATABASE_URL is set correctly in the .env file.

    Error thrown:
    `), e);
  process.exit(1);
});

function sha256(input: string) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  const hashObject = crypto.createHash("sha256");
  hashObject.update(input);

  return hashObject.digest("hex");
}

// function makeRecipeSuggestions(dataSeries: DataSeriesArray): RawRecipe[] {
//   return [
//     {
//       name: "Skala utifrån befolkning",
//       eq: "${förälder} * (${popF} / ${popB})",
//       variables: {
//         "förälder": {
//           type: RecipeVariableType.DataSeries,
//           value: dataSeries,
//         },
//         "popF": {
//           type: RecipeVariableType.Scalar,
//           value: 10587710,
//         },
//         "popB": {
//           type: RecipeVariableType.Scalar,
//           value: 504176,
//         }
//       }
//     },
//     {
//       name: "Skala utifrån yta",
//       eq: "${förälder} * (${areaF} / ${areaB})",
//       variables: {
//         "förälder": {
//           type: RecipeVariableType.DataSeries,
//           value: dataSeries,
//         },
//         "areaF": {
//           type: RecipeVariableType.Scalar,
//           value: 410000,
//         },
//         "areaB": {
//           type: RecipeVariableType.Scalar,
//           value: 60000,
//         }
//       }
//     },
//     {
//       name: "Skala utifrån fast värde",
//       eq: "${förälder} / ${value}",
//       variables: {
//         "förälder": {
//           type: RecipeVariableType.DataSeries,
//           value: dataSeries,
//         },
//         "value": {
//           type: RecipeVariableType.Scalar,
//           value: 2,
//         }
//       }
//     }
//   ];
// }

function getRandomDateInThePast(): Date {
  const roof = Date.now() - 1000 * 60; // 1 minute ago
  const floor = 1000 * 60; // 1 minute ago

  const randomTimestamp = Math.floor(Math.random() * (roof - floor + 1)) + floor;
  return new Date(randomTimestamp);
}

function getRandomCreatedAtAndUpdatedAt(): [Date, Date] {
  const createdAt = getRandomDateInThePast();
  const updatedAt = Math.random() < 0.75 ?
    createdAt
    :
    new Date(createdAt.getTime() + Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 365.2425 * 5)); // Randomly set updatedAt to be after createdAt

  return [createdAt, updatedAt];
}

function getRandomCoherentDataPoints(): Partial<Record<typeof dataSeriesDataFieldNames[number], number>> {
  const dataPoints: Partial<Record<typeof dataSeriesDataFieldNames[number], number>> = {};
  let startValue = Math.floor(Math.random() * 100); // Random start value between 0 and 99
  const deviation = Math.floor(Math.random() * 10) + 1; // Random deviation between 1 and 10
  for (const field of dataSeriesDataFieldNames) {
    const value = startValue + Math.floor(Math.random() * deviation) - Math.floor(Math.random() * deviation);
    if (value < 0) {
      dataPoints[field] = 0; // Ensure no negative values
      startValue = 0; // Reset start value to 0 if it goes negative
    } else {
      dataPoints[field] = value;
      startValue = value; // Update start value for next iteration
    }
  }
  return dataPoints;
}

async function main() {
  // TODO: We should consider adding more types of data to the seed, see the list below.
  // - More roadmaps and meta roadmaps
  // - Inheritance between meta roadmaps, roadmaps, goals (combined goals), and actions
  // - Links
  // - Notes?
  // - User groups?

  const passwords = {
    admin: await bcrypt.hash('admin', 10),
    anita: await bcrypt.hash('anita', 10),
    anton: await bcrypt.hash('anton', 10),
  };

  /** A user with admin rights, username and password 'admin' */
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: passwords.admin,
      isAdmin: true,
      isVerified: true,
      email: 'admin@admin.admin',
    }
  });

  /** Anita is a regular user :3 */
  const anita = await prisma.user.create({
    data: {
      username: 'Anita',
      password: passwords.anita,
      isAdmin: false,
      isVerified: true,
      email: 'anita@sustainable-action.org',
    }
  });

  /** Anton is a regular user who's been to lazy to verify themselves */
  const anton = await prisma.user.create({
    data: {
      username: 'Anton',
      password: passwords.anton,
      isAdmin: false,
      isVerified: false,
      email: 'anton@sustainable-action.org',
    }
  });

  const users = [admin, anita, anton];

  function makeRandomComment(options?: { roadmapId?: string, goalId?: string, actionId?: string, metaRoadmapId?: string }) {
    const author = users[Math.floor(Math.random() * users.length)];
    let [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
    return {
      authorId: author.id,
      commentText: RandomTextSE.sentence(Math.floor(Math.random() * 20) + 1),
      createdAt,
      updatedAt,
      ...(options && {
        ...(options.roadmapId ? { roadmapId: options.roadmapId } : {}),
        ...(options.goalId ? { goalId: options.goalId } : {}),
        ...(options.actionId ? { actionId: options.actionId } : {}),
        ...(options.metaRoadmapId ? { metaRoadmapId: options.metaRoadmapId } : {}),
      })
    };
  }

  // National roadmap - Riket
  let [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const nationalMetaRoadmap = await prisma.metaRoadmap.create({
    data: {
      name: 'Rikets färdplan',
      description: 'Denna färdplan har lagts för att ge stöd till andra aktörer att ärva ifrån.\n\nResurser:\nhttps://youtu.be/dQw4w9WgXcQ?si=fkzP2Rqg7d63tYaT\nhttps://sustainable-action.org/',
      actor: 'Sverige',
      type: RoadmapType.NATIONAL,
      authorId: anita.id,
      isPublic: true,
      comments: {
        createMany: {
          data: Array(40).fill(null).map(() => makeRandomComment()),
        }
      },
      createdAt,
      updatedAt,
      // TODO - add more props
    },
  });
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const nationalRoadmapVersion1 = await prisma.roadmap.create({
    data: {
      version: 1,
      authorId: anita.id,
      metaRoadmapId: nationalMetaRoadmap.id,
      description: nationalMetaRoadmap.description, // Inherit description from meta roadmap
      isPublic: true,
      comments: {
        createMany: {
          data: Array(30).fill(null).map(() => makeRandomComment()),
        }
      },
      // TODO - is this correct? 
      editors: {
        connect: [
          { id: admin.id },
          { id: anita.id },
          { id: anton.id },
        ],
      },
      createdAt,
      updatedAt,
    },
  });
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const nationalRoadmapVersion2 = await prisma.roadmap.create({
    data: {
      version: 2,
      authorId: anita.id,
      metaRoadmapId: nationalMetaRoadmap.id,
      description: nationalMetaRoadmap.description, // Inherit description from meta roadmap
      isPublic: true,
      comments: {
        createMany: {
          data: Array(30).fill(null).map(() => makeRandomComment()),
        }
      },
      // TODO - is this correct?
      editors: {
        connect: [
          { id: admin.id },
          { id: anita.id },
          { id: anton.id },
        ],
      },
      createdAt,
      updatedAt,
    },
  });

  // Regional roadmap - Uppsala
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const uppsalaMetaRoadmap = await prisma.metaRoadmap.create({
    data: {
      name: 'Uppsala län',
      description: 'Denna färdplan har lagts för att främst ge stöd till kommunerna inom länet.\n\nLänkar:\nhttps://www.lansstyrelsen.se/uppsala.html',
      actor: 'Uppsala län',
      type: RoadmapType.REGIONAL,
      authorId: admin.id,
      isPublic: true,
      comments: {
        createMany: {
          data: Array(20).fill(null).map(() => makeRandomComment()),
        }
      },
      createdAt,
      updatedAt,
    },
  });
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const uppsalaRoadmapVersion1 = await prisma.roadmap.create({
    data: {
      version: 1,
      authorId: admin.id,
      metaRoadmapId: uppsalaMetaRoadmap.id,
      description: uppsalaMetaRoadmap.description, // Inherit description from meta roadmap
      isPublic: true,
      comments: {
        createMany: {
          data: Array(10).fill(null).map(() => makeRandomComment()),
        }
      },
      // TODO - is this correct?
      editors: {
        connect: [
          { id: admin.id },
          { id: anita.id },
          { id: anton.id },
        ],
      },
      createdAt,
      updatedAt,
    },
  });
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const uppsalaRoadmapVersion2 = await prisma.roadmap.create({
    data: {
      version: 2,
      authorId: admin.id,
      metaRoadmapId: uppsalaMetaRoadmap.id,
      description: uppsalaMetaRoadmap.description, // Inherit description from meta roadmap
      isPublic: false, // Private version (maybe before public release?)
      comments: {
        createMany: {
          data: Array(10).fill(null).map(() => makeRandomComment()),
        }
      },
      // TODO - is this correct?
      editors: {
        connect: [
          { id: admin.id },
          { id: anita.id },
          { id: anton.id },
        ],
      },
      createdAt,
      updatedAt,
    },
  });

  // Basic data series to use in goals, actions, and recipes
  [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
  const dataSeriesPlural = await prisma.dataSeries.createMany({
    data: Array(10).fill(null).map(() => ({
      authorId: users[Math.floor(Math.random() * users.length)].id,
      createdAt,
      updatedAt,
      unit: ['CO2e', 'kWh', 'm3', 'kg', 'ton', null, ''].sort(() => Math.random() - 0.5).at(0) ?? null,
      ...getRandomCoherentDataPoints(),
    })),
  });



  // // We use prisma.$transaction instead of prisma.goal.createManyAndReturn as it allows
  // // nested data creation, which is necessary for creating data series for each goal.
  // const goals = await prisma.$transaction(Array(10).fill(null).map((_) => (
  //   prisma.goal.create({
  //     data: {
  //       name: lorem.generateWords(3),
  //       description: lorem.generateSentences(3),
  //       indicatorParameter: lorem.generateWords(5).replace(/\s/g, '\\'),
  //       isFeatured: Math.random() > 0.7,
  //       // TODO: Add external data to some goals
  //       authorId: admin.id,
  //       roadmapId: mainRoadmap.id,
  //       // Random data series for each goal
  //       dataSeries: {
  //         create: {
  //           // TODO: Add more possible units
  //           unit: 's',
  //           val2020: Math.random() * 100,
  //           val2021: Math.random() * 100,
  //           val2022: Math.random() * 100,
  //           val2023: Math.random() * 100,
  //           val2024: Math.random() * 100,
  //           val2025: Math.random() * 100,
  //           val2026: Math.random() * 100,
  //           val2027: Math.random() * 100,
  //           val2028: Math.random() * 100,
  //           val2029: Math.random() * 100,
  //           val2030: Math.random() * 100,
  //           val2031: Math.random() * 100,
  //           val2032: Math.random() * 100,
  //           val2033: Math.random() * 100,
  //           val2034: Math.random() * 100,
  //           val2035: Math.random() * 100,
  //           val2036: Math.random() * 100,
  //           val2037: Math.random() * 100,
  //           val2038: Math.random() * 100,
  //           val2039: Math.random() * 100,
  //           val2040: Math.random() * 100,
  //           val2041: Math.random() * 100,
  //           val2042: Math.random() * 100,
  //           val2043: Math.random() * 100,
  //           val2044: Math.random() * 100,
  //           val2045: Math.random() * 100,
  //           val2046: Math.random() * 100,
  //           val2047: Math.random() * 100,
  //           val2048: Math.random() * 100,
  //           val2049: Math.random() * 100,
  //           val2050: Math.random() * 100,
  //           authorId: admin.id,
  //         }
  //       }
  //     },
  //     include: {
  //       dataSeries: true,
  //     }
  //   })
  // )));

  // const actions = await prisma.$transaction(Array(10).fill(null).map((_) => (
  //   prisma.action.create({
  //     data: {
  //       name: lorem.generateWords(3),
  //       description: lorem.generateSentences(3),
  //       startYear: 2020 + Math.round(Math.random() * 10),
  //       endYear: 2050 - Math.round(Math.random() * 10),
  //       costEfficiency: lorem.generateWords(1),
  //       expectedOutcome: lorem.generateSentences(1),
  //       projectManager: lorem.generateWords(2),
  //       relevantActors: lorem.generateSentences(1).replace(" ", ", "),
  //       isSufficiency: Math.random() > 0.7,
  //       isEfficiency: Math.random() > 0.7,
  //       isRenewables: Math.random() > 0.7,
  //       authorId: admin.id,
  //       roadmapId: mainRoadmap.id,
  //       effects: {
  //         create: [
  //           {
  //             dataSeries: {
  //               create: {
  //                 unit: '',
  //                 val2020: Math.random() * 100,
  //                 val2021: Math.random() * 100,
  //                 val2022: Math.random() * 100,
  //                 val2023: Math.random() * 100,
  //                 val2024: Math.random() * 100,
  //                 val2025: Math.random() * 100,
  //                 val2026: Math.random() * 100,
  //                 val2027: Math.random() * 100,
  //                 val2028: Math.random() * 100,
  //                 val2029: Math.random() * 100,
  //                 val2030: Math.random() * 100,
  //                 val2031: Math.random() * 100,
  //                 val2032: Math.random() * 100,
  //                 val2033: Math.random() * 100,
  //                 val2034: Math.random() * 100,
  //                 val2035: Math.random() * 100,
  //                 val2036: Math.random() * 100,
  //                 val2037: Math.random() * 100,
  //                 val2038: Math.random() * 100,
  //                 val2039: Math.random() * 100,
  //                 val2040: Math.random() * 100,
  //                 val2041: Math.random() * 100,
  //                 val2042: Math.random() * 100,
  //                 val2043: Math.random() * 100,
  //                 val2044: Math.random() * 100,
  //                 val2045: Math.random() * 100,
  //                 val2046: Math.random() * 100,
  //                 val2047: Math.random() * 100,
  //                 val2048: Math.random() * 100,
  //                 val2049: Math.random() * 100,
  //                 val2050: Math.random() * 100,
  //                 authorId: admin.id,
  //               }
  //             },
  //             // Assign to goal 0, 1, or 2 (Math.random() is always < 1)
  //             goalId: goals[Math.floor(Math.random() * 3)]?.id,
  //           },
  //           {
  //             dataSeries: {
  //               create: {
  //                 unit: '',
  //                 val2020: Math.random() * 100,
  //                 val2021: Math.random() * 100,
  //                 val2022: Math.random() * 100,
  //                 val2023: Math.random() * 100,
  //                 val2024: Math.random() * 100,
  //                 val2025: Math.random() * 100,
  //                 val2026: Math.random() * 100,
  //                 val2027: Math.random() * 100,
  //                 val2028: Math.random() * 100,
  //                 val2029: Math.random() * 100,
  //                 val2030: Math.random() * 100,
  //                 val2031: Math.random() * 100,
  //                 val2032: Math.random() * 100,
  //                 val2033: Math.random() * 100,
  //                 val2034: Math.random() * 100,
  //                 val2035: Math.random() * 100,
  //                 val2036: Math.random() * 100,
  //                 val2037: Math.random() * 100,
  //                 val2038: Math.random() * 100,
  //                 val2039: Math.random() * 100,
  //                 val2040: Math.random() * 100,
  //                 val2041: Math.random() * 100,
  //                 val2042: Math.random() * 100,
  //                 val2043: Math.random() * 100,
  //                 val2044: Math.random() * 100,
  //                 val2045: Math.random() * 100,
  //                 val2046: Math.random() * 100,
  //                 val2047: Math.random() * 100,
  //                 val2048: Math.random() * 100,
  //                 val2049: Math.random() * 100,
  //                 val2050: Math.random() * 100,
  //                 authorId: admin.id,
  //               }
  //             },
  //             // Assign to goal 3, 4, or 5
  //             goalId: goals[Math.floor(Math.random() * 3) + 3]?.id,
  //           },
  //           {
  //             dataSeries: {
  //               create: {
  //                 unit: '',
  //                 val2020: Math.random() * 100,
  //                 val2021: Math.random() * 100,
  //                 val2022: Math.random() * 100,
  //                 val2023: Math.random() * 100,
  //                 val2024: Math.random() * 100,
  //                 val2025: Math.random() * 100,
  //                 val2026: Math.random() * 100,
  //                 val2027: Math.random() * 100,
  //                 val2028: Math.random() * 100,
  //                 val2029: Math.random() * 100,
  //                 val2030: Math.random() * 100,
  //                 val2031: Math.random() * 100,
  //                 val2032: Math.random() * 100,
  //                 val2033: Math.random() * 100,
  //                 val2034: Math.random() * 100,
  //                 val2035: Math.random() * 100,
  //                 val2036: Math.random() * 100,
  //                 val2037: Math.random() * 100,
  //                 val2038: Math.random() * 100,
  //                 val2039: Math.random() * 100,
  //                 val2040: Math.random() * 100,
  //                 val2041: Math.random() * 100,
  //                 val2042: Math.random() * 100,
  //                 val2043: Math.random() * 100,
  //                 val2044: Math.random() * 100,
  //                 val2045: Math.random() * 100,
  //                 val2046: Math.random() * 100,
  //                 val2047: Math.random() * 100,
  //                 val2048: Math.random() * 100,
  //                 val2049: Math.random() * 100,
  //                 val2050: Math.random() * 100,
  //                 authorId: admin.id,
  //               }
  //             },
  //             // Assign to goal 6, 7, 8, or 9
  //             goalId: goals[Math.floor(Math.random() * 4) + 6]?.id,
  //           }
  //         ],
  //       }
  //     },
  //     include: {
  //       effects: {
  //         include: {
  //           dataSeries: true,
  //         }
  //       }
  //     }
  //   })
  // )));

  // const users = await prisma.$transaction(Array(5).fill(null).map((_, index) => (
  //   prisma.user.create({
  //     data: {
  //       username: `${lorem.generateWords(1)}-${index}`,
  //       password: hashedAdminPassword,
  //       email: `${lorem.generateWords(2).replace(" ", ".")}+${index}@example.com`,
  //       isAdmin: false,
  //       isVerified: true,
  //     }
  //   })
  // )));

  // const _comments = await prisma.$transaction(Array(30).fill(null).map((_) => {
  //   const commentType = Math.random();
  //   return prisma.comment.create({
  //     data: {
  //       commentText: lorem.generateParagraphs(1),
  //       authorId: users[Math.floor(Math.random() * users.length)]?.id,
  //       metaRoadmapId: commentType < 0.15 ? mainMetaRoadmap.id : null,
  //       roadmapId: commentType >= 0.15 && commentType < 0.3 ? mainRoadmap.id : null,
  //       goalId: commentType >= 0.3 && commentType < 0.65 ? goals[Math.floor(Math.random() * goals.length)]?.id : null,
  //       actionId: commentType >= 0.65 ? actions[Math.floor(Math.random() * actions.length)]?.id : null,
  //     }
  //   })
  // }));

  // const testingDataSeries = {
  //   val2020: 10,
  //   val2021: 20,
  //   val2022: 30,
  //   val2023: 40,
  //   val2024: 50,
  //   val2025: 60,
  //   val2026: 70,
  //   val2027: 80,
  //   val2028: 90,
  //   val2029: 100,
  //   val2030: 110,
  //   val2031: 120,
  //   val2032: 130,
  //   val2033: 140,
  //   val2034: 150,
  //   val2035: 160,
  //   val2036: 170,
  //   val2037: 180,
  //   val2038: 190,
  //   val2039: 200,
  //   val2040: 210,
  //   val2041: 220,
  //   val2042: 230,
  //   val2043: 240,
  //   val2044: 250,
  //   val2045: 260,
  //   val2046: 270,
  //   val2047: 280,
  //   val2048: 290,
  //   val2049: 300,
  //   val2050: 310,
  // }

  // const _goalWithRecipeSuggestions = await prisma.goal.create({
  //   data: {
  //     name: 'Goal with Recipe Suggestions',
  //     description: 'This goal has recipe suggestions for testing purposes.',
  //     indicatorParameter: 'test-parameter',
  //     isFeatured: true,
  //     authorId: admin.id,
  //     roadmapId: mainRoadmap.id,
  //     dataSeries: {
  //       create: {
  //         unit: 'test-unit',
  //         ...testingDataSeries,
  //         authorId: admin.id,
  //       }
  //     },
  //     recipeSuggestions: {
  //       create: makeRecipeSuggestions(testingDataSeries)
  //         .map(recipe => ({
  //           hash: sha256(recipe),
  //           recipe,
  //         })),
  //     }
  //   },
  //   // Include?
  // });
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