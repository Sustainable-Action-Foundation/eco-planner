// DO NOT SEED PRODUCTION DATABASE

import { colors } from "../src/scripts/lib/colors";
import { PrismaClient, RoadmapType } from '../src/prisma/generated';
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { RandomTextSE } from "./randomText";
import { dataSeriesDataFieldNames } from "@/types";
import { Recipe, RecipeVariableType } from "@/functions/recipe-parser/types";

const prisma = new PrismaClient();
prisma.$connect().catch((e) => {
  console.error(colors.yellow(`
    Could not connect to the database. Ensure DATABASE_URL is set correctly in the .env file.

    Error thrown:
    `), e);
  process.exit(1);
});

function sha256(input: string): string {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  const hashObject = crypto.createHash("sha256");
  hashObject.update(input);

  return hashObject.digest("hex");
}

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

function getRandomUnit() {
  return ['CO2e', 'capita', 'kWh', 's', 'mm^2/km*s', 'ps/sqrt(km)', 'ps/km^0.5', 'm3', 'kg', 'ton', 'Atemp', null, '', null, undefined, null, '', ""].sort(() => Math.random() - 0.5).at(0) ?? null;
}

function getRandomCoherentDataPoints(): Partial<Record<typeof dataSeriesDataFieldNames[number], number>> {
  const dataPoints: Partial<Record<typeof dataSeriesDataFieldNames[number], number>> = {};
  let startValue = Math.floor(Math.random() * 10000);
  const deviation = Math.floor(Math.random() * startValue + startValue / 100);
  const inclination = Math.random() < 0.5 ? -1 : 1; // Randomly choose to increase or decrease values

  const fields: typeof dataSeriesDataFieldNames = [];

  // Small chance to get random start and end years
  if (Math.random() < 0.2) {
    const emptyStart = dataSeriesDataFieldNames.slice(0, Math.floor(Math.random() * 10));
    const emptyEnd = dataSeriesDataFieldNames.slice(-Math.floor(Math.random() * 10));

    for (const year of dataSeriesDataFieldNames) {
      if (!emptyStart.includes(year) && !emptyEnd.includes(year)) {
        fields.push(year);
      }
    }
  }
  else {
    fields.push(...dataSeriesDataFieldNames); // Use all fields
  }

  for (const field of fields) { // Chance of skipping a field
    if (Math.random() < 0.01) {
      continue; // Skip this field
    }

    const value = startValue + Math.random() * inclination * (Math.floor(Math.random() * deviation) - Math.floor(Math.random() * deviation) / 2);
    if (value < 0) {
      dataPoints[field] = 0; // Ensure no negative values
      startValue = 0; // Reset start value to 0 if it goes negative
    } else {
      dataPoints[field] = value;
      startValue = value; // Update start value for next iteration
    }
  }

  // TODO - add limit to recursion depth. Not that important since it's incredibly unlikely that it will be a problem
  if (Object.keys(dataPoints).length === 0) {
    return getRandomCoherentDataPoints();
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

  /*
   * Users
   */
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


  /* 
   * Helper function - depends on the users above
   */
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


  /*
   * Meta Roadmaps and their versions
   */
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
      description: "Det här den första versionen av den nationella färdplanen.",
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
      description: "Det här den andra versionen av den nationella färdplanen.",
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


  /* 
   * Basic recipes
   */
  const basicRecipes = await prisma.$transaction([
    (() => { // By area
      const recipe: Recipe = {
        name: 'Skala utifrån yta',
        eq: '${Riket} * ${ArvingsArea} / ${RiketsArea}',
        variables: {
          'Riket': {
            type: RecipeVariableType.DataSeries,
            link: null,
          },
          'RiketsArea': {
            type: RecipeVariableType.External,
            dataset: 'SCB',
            tableId: 'TAB6420',
            selection: [
              // Selected area
              { variableCode: 'Region', valueCodes: ["00"], },
              // Specifically land areas, not including water
              { variableCode: "ArealTyp", valueCodes: ["01"] },
              // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
              { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
            ],
          },
          'ArvingsArea': {
            type: RecipeVariableType.External,
            dataset: 'SCB',
            tableId: 'TAB6420',
            selection: [
              // Specifically land areas, not including water
              { variableCode: "ArealTyp", valueCodes: ["01"] },
              // Magic string to get area sizes in square kilometers (as opposed to hectares with "000007E1")
              { variableCode: "ContentsCode", valueCodes: ["000007DY"] },
            ],
          },
        },
      };
      return prisma.recipe.create({
        data: {
          hash: sha256(JSON.stringify(recipe)),
          recipe: recipe,
        },
      });
    })(),
    (() => { // By population
      const recipe: Recipe = {
        name: 'Skala utifrån befolkning',
        eq: '${Riket} * ${ArvingsPopulation} / ${RiketsPopulation}',
        variables: {
          'Riket': {
            type: RecipeVariableType.DataSeries,
            link: null,
          },
          'RiketsPopulation': {
            type: RecipeVariableType.External,
            dataset: 'SCB',
            tableId: 'BE0101N1',
            selection: [
              // Selected area
              { variableCode: 'Region', valueCodes: ["00"], },
              // Magic string to get population numbers
              { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
            ],
          },
          'ArvingsPopulation': {
            type: RecipeVariableType.External,
            dataset: 'SCB',
            tableId: 'BE0101N1',
            selection: [
              // Magic string to get population numbers
              { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
            ],
          },
        },
      };
      return prisma.recipe.create({
        data: {
          hash: sha256(JSON.stringify(recipe)),
          recipe: recipe,
        },
      });
    })(),
    (() => { // By scalar
      const recipe: Recipe = {
        name: 'Skala utifrån fast värde',
        eq: '${Riket} / ${skalär}',
        variables: {
          'Riket': {
            type: RecipeVariableType.DataSeries,
            link: null,
          },
          'skalär': {
            type: RecipeVariableType.Scalar,
            value: 1 + Math.random(),
          },
        },
      };
      return prisma.recipe.create({
        data: {
          hash: sha256(JSON.stringify(recipe)),
          recipe: recipe,
        },
      });
    })(),
  ]);


  /* 
   * Goals
   */
  // National goals v1
  const nationalDataSeriesV1 = await prisma.$transaction(
    Array(10).fill(null).map(() => {
      [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
      return prisma.dataSeries.create({
        data: {
          authorId: users[Math.floor(Math.random() * users.length)].id,
          createdAt,
          updatedAt,
          unit: getRandomUnit(),
          ...getRandomCoherentDataPoints(),
        }
      });
    })
  );
  let parameters = new Array(8).fill(null).map(() => RandomTextSE.words(Math.floor(Math.random() * 5) + 1).replace(/\s/g, '\\'));
  const nationalGoalsV1 = await prisma.$transaction(
    Array(10).fill(null).map((_, i) => {
      [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
      return prisma.goal.create({
        data: {
          name: RandomTextSE.sentence(3, 1),
          description: RandomTextSE.paragraph(Math.floor(Math.random() * 3) + 1),
          indicatorParameter: parameters[Math.floor(Math.random() * parameters.length)],
          isFeatured: Math.random() > 0.7,
          authorId: users[Math.floor(Math.random() * users.length)].id,
          roadmapId: nationalRoadmapVersion1.id,
          dataSeries: {
            connect: { id: nationalDataSeriesV1[i].id },
          },
          recipeSuggestions: {
            connect: [
              { hash: basicRecipes[0].hash },
              { hash: basicRecipes[1].hash },
              { hash: basicRecipes[2].hash },
            ],
          }
        },
      });
    })
  );

  // National goals v2 - inherit with recipes from v1
  const nationalDataSeriesV2 = await prisma.$transaction(
    Array(3).fill(null).map(() => {
      [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
      return prisma.dataSeries.create({
        data: {
          authorId: users[Math.floor(Math.random() * users.length)].id,
          createdAt,
          updatedAt,
          unit: getRandomUnit(),
          ...getRandomCoherentDataPoints(),
        }
      });
    })
  );


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