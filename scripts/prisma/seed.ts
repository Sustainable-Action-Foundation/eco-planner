// DO NOT SEED PRODUCTION DATABASE

import { colors } from "../lib/colors.ts";
import { PrismaClient, RoadmapType } from '../../src/prisma/generated';
import bcrypt from "bcryptjs";
import { RandomTextSE } from "./randomText";
import { RecipeDataTypes, VectorIndexPickerOptions } from "../../src/functions/recipe/types";
import { Recipe } from "../../src/functions/recipe/recipe";
import { isISOIshDate } from "../../src/types";
import type { DateValues } from "../../src/types";
import { dateValuesToDBDateRecord } from "../../src/functions/recipe/vectorAndMaskUtils";

const prisma = new PrismaClient();
prisma.$connect().catch((e: unknown) => {
  console.error(colors.yellow(`
    Could not connect to the database. Ensure DATABASE_URL is set correctly in the .env file.

    Error thrown:
    `), e);
  process.exit(1);
});

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

function getRandomUnit(): string | null | undefined {
  return ['CO2e', 'capita', 'kWh', 's', 'mm^2/km*s', 'ps/sqrt(km)', 'ps/km^0.5', 'm3', 'kg', 'ton', 'Atemp', null, '', null, undefined, null, '', "", undefined, ,]
    .sort(() => Math.random() - 0.5).at(0);
}

function isDateValuesKey(value: string): value is keyof DateValues {
  return isISOIshDate(value);
}

function getRandomCoherentDateValues(): DateValues {
  const dateRange: number[] = new Array(30).fill(0).map((_, i) => 2020 + i);

  const dataPoints: DateValues = {};

  let startValue = Math.floor(Math.random() * 10000);
  const deviation = Math.floor(Math.random() * startValue + startValue / 100);
  const inclination = Math.random() < 0.5 ? -1 : 1; // Randomly choose to increase or decrease values

  const fields: number[] = [];

  // Small chance to get random start and end years
  if (Math.random() < 0.2) {
    const emptyStart = dateRange.slice(0, Math.floor(Math.random() * 10));
    const emptyEnd = dateRange.slice(-Math.floor(Math.random() * 10));

    for (const date of dateRange) {
      if (!emptyStart.includes(date) && !emptyEnd.includes(date)) {
        fields.push(date);
      }
    }
  }
  else {
    fields.push(...dateRange); // Use all fields
  }

  for (const field of fields) { // Chance of skipping a field
    if (Math.random() < 0.01) {
      continue; // Skip this field
    }

    const value = startValue + Math.random() * inclination * (Math.floor(Math.random() * deviation) - Math.floor(Math.random() * deviation) / 2);
    const timestamp = new Date(Date.UTC(field, 0, 1)).toISOString();
    if (!isDateValuesKey(timestamp)) {
      throw new Error(`Generated timestamp ${timestamp} is not in a valid format.`);
    }
    dataPoints[timestamp] = value;
    startValue = value; // Update start value for next iteration
  }

  // TODO - add limit to recursion depth. Not that important since it's incredibly unlikely that it will be a problem
  if (Object.keys(dataPoints).length === 0) {
    return getRandomCoherentDateValues();
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
    const [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
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
  await prisma.roadmap.create({
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
  await prisma.roadmap.create({
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
  await prisma.$transaction([
    (() => { // By area
      const recipe = new Recipe({
        name: 'Skala utifrån yta',
        equation: '${Riket} * ${ArvingsArea} / ${RiketsArea}',
        variables: {
          'Riket': {
            type: RecipeDataTypes.DataSeries,
            link: null,
            pick: VectorIndexPickerOptions.Default,
            value: null,
            unit: "km^2",
          },
          'RiketsArea': {
            type: RecipeDataTypes.External,
            pick: VectorIndexPickerOptions.Default,
            unit: undefined,
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
            type: RecipeDataTypes.External,
            pick: VectorIndexPickerOptions.Default,
            unit: undefined,
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
      });
      return prisma.recipe.create({
        data: {
          recipe: recipe.serialize(),
        },
      });
    })(),
    (() => { // By population
      const recipe = new Recipe({
        name: 'Skala utifrån befolkning',
        equation: '${Riket} * ${ArvingsPopulation} / ${RiketsPopulation}',
        variables: {
          'Riket': {
            type: RecipeDataTypes.DataSeries,
            link: null,
            pick: VectorIndexPickerOptions.Default,
            value: null,
            unit: "capita",
          },
          'RiketsPopulation': {
            type: RecipeDataTypes.External,
            pick: VectorIndexPickerOptions.Default,
            unit: undefined,
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
            type: RecipeDataTypes.External,
            pick: VectorIndexPickerOptions.Default,
            unit: undefined,
            dataset: 'SCB',
            tableId: 'BE0101N1',
            selection: [
              // Magic string to get population numbers
              { variableCode: "ContentsCode", valueCodes: ["000007E1"] },
            ],
          },
        },
      });
      return prisma.recipe.create({
        data: {
          recipe: recipe.serialize(),
        },
      });
    })(),
    (() => { // By scalar
      const recipe = new Recipe({
        name: 'Skala utifrån fast värde',
        equation: '${Riket} / ${skalär}',
        variables: {
          'Riket': {
            type: RecipeDataTypes.DataSeries,
            link: null,
            pick: VectorIndexPickerOptions.Default,
            value: null,
            unit: getRandomUnit(),
          },
          'skalär': {
            type: RecipeDataTypes.Scalar,
            value: 1 + Math.random(),
            unit: null,
          },
        },
      });
      return prisma.recipe.create({
        data: {
          recipe: recipe.serialize(),
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
      const dateValues = getRandomCoherentDateValues();
      return prisma.dataSeries.create({
        data: {
          authorId: users[Math.floor(Math.random() * users.length)].id,
          createdAt,
          updatedAt,
          unit: getRandomUnit(),
          values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
        }
      });
    })
  );
  const nationalV1Recipes = await prisma.$transaction(
    nationalDataSeriesV1.map((dataSeries, index) => {
      const recipe = new Recipe({
        name: `1:1 nationell mal ${index + 1}`,
        equation: '${Riket}',
        variables: {
          'Riket': {
            type: RecipeDataTypes.DataSeries,
            link: dataSeries.id,
            pick: VectorIndexPickerOptions.Default,
            value: null,
            unit: dataSeries.unit ?? undefined,
          },
        },
      });
      return prisma.recipe.create({
        data: {
          recipe: recipe.serialize(),
        },
      });
    }),
  );
  // This will be reassigned later
  // eslint-disable-next-line prefer-const
  let parameters = new Array(8).fill(null).map(() => RandomTextSE.words(Math.floor(Math.random() * 5) + 1).replace(/\s/g, '\\'));
  await prisma.$transaction(
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
          dataSeriesId: nationalDataSeriesV1[i].id,
          recipeSuggestions: {
            connect: [
              { id: nationalV1Recipes[i].id },
            ],
          },
        },
      });
    })
  );

  // National goals v2 - inherit with recipes from v1
  await prisma.$transaction(async (tx) => Promise.all(
    nationalV1Recipes.map(async (recipe) => {
      [createdAt, updatedAt] = getRandomCreatedAtAndUpdatedAt();
      const dateValues = getRandomCoherentDateValues();
      const dataSeries = await tx.dataSeries.create({
        data: {
          authorId: users[Math.floor(Math.random() * users.length)].id,
          createdAt,
          updatedAt,
          unit: getRandomUnit(),
          values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
        },
      });

      return tx.goal.create({
        data: {
          name: RandomTextSE.sentence(3, 1),
          description: RandomTextSE.paragraph(Math.floor(Math.random() * 3) + 1),
          indicatorParameter: parameters[Math.floor(Math.random() * parameters.length)],
          isFeatured: Math.random() > 0.7,
          authorId: users[Math.floor(Math.random() * users.length)].id,
          roadmapId: nationalRoadmapVersion2.id,
          dataSeriesId: dataSeries.id,
          recipeSuggestions: {
            connect: [{ id: recipe.id }],
          }
        },
      });
    })
  ));
}

main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e: unknown) => {
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