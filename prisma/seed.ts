// DO NOT SEED PRODUCTION DATABASE

import { colors } from "../src/scripts/lib/colors";
import { PrismaClient, RoadmapType } from '../src/prisma/generated';
import bcrypt from "bcryptjs";
import { RandomTextSE } from "./randomText";
import { DataSeriesValueFields, Years } from "@/types";
import { Recipe, RecipeDataTypes, VectorIndexPickerOptions } from "@/functions/recipe-parser/types";
import { hashRecipe } from "@/functions/recipe-parser/getRecipeHash";
import { allOurUnits } from "@/math";

const prisma = new PrismaClient();
prisma.$connect().catch((e) => {
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

function getRandomCreatedAtAndUpdatedAt(): { createdAt: Date; updatedAt: Date } {
  const createdAt = getRandomDateInThePast();
  const updatedAt = Math.random() < 0.75 ?
    createdAt
    :
    new Date(createdAt.getTime() + Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 365.2425 * 5)); // Randomly set updatedAt to be after createdAt

  return { createdAt, updatedAt };
}

function getRandomUnit(): string | null | undefined {
  const nullChance = 0.1;
  const undefinedChance = 0.1;

  if (Math.random() < nullChance) return null;
  if (Math.random() < undefinedChance) return undefined;

  return allOurUnits[Math.floor(Math.random() * allOurUnits.length)];
}

function getRandomCoherentDataPoints(): Partial<DataSeriesValueFields> {
  const dataPoints: Partial<Record<typeof Years[number], number>> = {};
  let startValue = Math.floor(Math.random() * 10000);
  const deviation = Math.floor(Math.random() * startValue + startValue / 100);
  const inclination = Math.random() < 0.5 ? -1 : 1; // Randomly choose to increase or decrease values

  const fields: typeof Years = [];

  // Small chance to get random start and end years
  if (Math.random() < 0.2) {
    const emptyStart = Years.slice(0, Math.floor(Math.random() * 10));
    const emptyEnd = Years.slice(-Math.floor(Math.random() * 10));

    for (const year of Years) {
      if (!emptyStart.includes(year) && !emptyEnd.includes(year)) {
        fields.push(year);
      }
    }
  }
  else {
    fields.push(...Years); // Use all fields
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

function getParameter(): string {
  const parameters = new Array(8).fill(null).map(() => RandomTextSE.words(Math.floor(Math.random() * 5) + 1).replace(/\s/g, '\\'));
  return parameters[Math.floor(Math.random() * parameters.length)];
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

  function getRandomUser() {
    return users[Math.floor(Math.random() * users.length)];
  }

  /* 
   * Helper function - depends on the users above
   */
  function makeRandomComment(options?: { roadmapId?: string, goalId?: string, actionId?: string, metaRoadmapId?: string }) {
    return {
      authorId: getRandomUser().id,
      commentText: RandomTextSE.sentence(Math.floor(Math.random() * 20) + 1),
      ...getRandomCreatedAtAndUpdatedAt(),
      ...(options && {
        ...(options.roadmapId ? { roadmapId: options.roadmapId } : {}),
        ...(options.goalId ? { goalId: options.goalId } : {}),
        ...(options.actionId ? { actionId: options.actionId } : {}),
        ...(options.metaRoadmapId ? { metaRoadmapId: options.metaRoadmapId } : {}),
      })
    };
  }

  function makeOneToOneRecipe(link: string, unit?: string | null): Recipe {
    if (!link || link.trim() === "") {
      throw new Error("Link must be a non-empty string");
    }

    return {
      name: "1:1 Recept",
      eq: "${serie}",
      variables: {
        "serie": {
          type: RecipeDataTypes.DataSeries,
          pick: VectorIndexPickerOptions.Whole,
          unit,
          link,
        },
      },
    };
  }
  function makeScaledRecipe(link: string, scale: number, unit?: string | null): Recipe {
    if (!link || link.trim() === "") {
      throw new Error("Link must be a non-empty string");
    }

    return {
      name: "Skala",
      eq: "${serie} * ${skalär}",
      variables: {
        "serie": {
          type: RecipeDataTypes.DataSeries,
          pick: VectorIndexPickerOptions.Whole,
          unit,
          link,
        },
        "skalär": {
          type: RecipeDataTypes.Scalar,
          value: scale,
          unit: undefined,
        },
      },
    };
  }

  /*
   * National - Riket
   */
  // Meta and versions  
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
      ...getRandomCreatedAtAndUpdatedAt(),
      // TODO - add more props
    },
  });
  const nationalRoadmapV1 = await prisma.roadmap.create({
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
      ...getRandomCreatedAtAndUpdatedAt(),
    },
  });
  const nationalRoadmapV2 = await prisma.roadmap.create({
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
      ...getRandomCreatedAtAndUpdatedAt(),
    },
  });

  // Raw
  const nationalV1RawGoal = await prisma.goal.create({
    data: {
      authorId: getRandomUser().id,
      roadmapId: nationalRoadmapV1.id,
      name: RandomTextSE.sentence(3, 1),
      description: RandomTextSE.paragraph(3, 2),
      indicatorParameter: getParameter(),
      isFeatured: true,
      dataSeries: {
        create: {
          authorId: getRandomUser().id,
          unit: getRandomUnit(),
          ...getRandomCreatedAtAndUpdatedAt(),
          ...getRandomCoherentDataPoints(),
        }
      },
    },
    include: {
      dataSeries: true,
    }
  });
  // 2.5 * raw = derived
  const scaledRecipeOfNationalV1Raw = makeScaledRecipe(nationalV1RawGoal.dataSeries?.id ?? "", 2.5, nationalV1RawGoal.dataSeries?.unit);
  const nationalV1DerivedRecipe = await prisma.recipe.create({
    data: {
      hash: hashRecipe(scaledRecipeOfNationalV1Raw),
      recipe: scaledRecipeOfNationalV1Raw,
      usedDataSeries: {
        connect: { id: nationalV1RawGoal.dataSeries?.id ?? "" },
      },
    },
  });
  const nationalV1DerivedDataSeriesResult = await prisma.recipe.update({
    where: { hash: nationalV1DerivedRecipe.hash },
    data: {
      usedDataSeries: {
        create: {
          authorId: getRandomUser().id,
          unit: undefined,
          ...getRandomCreatedAtAndUpdatedAt(),
          ...getRandomCoherentDataPoints(),
        }
      }
    },
    include: { usedDataSeries: true },
  });
  const nationalV1DerivedDataSeries = nationalV1DerivedDataSeriesResult.usedDataSeries[nationalV1DerivedDataSeriesResult.usedDataSeries.length - 1];

  const nationalV1DerivedGoal = await prisma.goal.create({
    data: {
      authorId: getRandomUser().id,
      roadmapId: nationalRoadmapV1.id,
      name: RandomTextSE.sentence(3, 1),
      description: RandomTextSE.paragraph(3, 2),
      indicatorParameter: getParameter(),
      isFeatured: true,
      dataSeries: {
        connect: { id: nationalV1DerivedDataSeries.id },
      },
      recipeUsedId: nationalV1DerivedRecipe.hash,
    },
  });
  // Copy of raw on V2
  const oneToOneRecipeOfNationalV1Raw = makeOneToOneRecipe(nationalV1RawGoal.dataSeries?.id ?? "", nationalV1RawGoal.dataSeries?.unit);
  const nationalV2CopyRecipe = await prisma.recipe.create({
    data: {
      hash: hashRecipe(oneToOneRecipeOfNationalV1Raw),
      recipe: oneToOneRecipeOfNationalV1Raw,
      usedDataSeries: {
        connect: { id: nationalV1RawGoal.dataSeries?.id ?? "" },
      },
    },
  });
  const nationalV2CopyDataSeriesResult = await prisma.recipe.update({
    where: { hash: nationalV2CopyRecipe.hash },
    data: {
      usedDataSeries: {
        create: {
          authorId: getRandomUser().id,
          unit: undefined,
          ...getRandomCreatedAtAndUpdatedAt(),
          ...getRandomCoherentDataPoints(),
        }
      }
    },
    include: { usedDataSeries: true },
  });
  const nationalV2CopyDataSeries = nationalV2CopyDataSeriesResult.usedDataSeries[nationalV2CopyDataSeriesResult.usedDataSeries.length - 1];

  const nationalV2CopyOfRawGoal = await prisma.goal.create({
    data: {
      authorId: getRandomUser().id,
      roadmapId: nationalRoadmapV2.id,
      name: nationalV1RawGoal.name,
      description: nationalV1RawGoal.description,
      indicatorParameter: nationalV1RawGoal.indicatorParameter,
      isFeatured: true,
      dataSeries: {
        connect: { id: nationalV2CopyDataSeries.id },
      },
      recipeUsedId: nationalV2CopyRecipe.hash,
    },
  });
  // Scaled version of the derived goal of V1 on V2
  const scaledRecipeOfNationalV1Derived = makeScaledRecipe(nationalV1DerivedDataSeries.id ?? "", 0.4, nationalV1DerivedDataSeries.unit);
  const nationalV2ScaledDerivedRecipe = await prisma.recipe.create({
    data: {
      hash: hashRecipe(scaledRecipeOfNationalV1Derived),
      recipe: scaledRecipeOfNationalV1Derived,
      usedDataSeries: {
        connect: { id: nationalV1DerivedDataSeries.id ?? "" },
      },
    },
  });
  const nationalV2ScaledDerivedDataSeriesResult = await prisma.recipe.update({
    where: { hash: nationalV2ScaledDerivedRecipe.hash },
    data: {
      usedDataSeries: {
        create: {
          authorId: getRandomUser().id,
          unit: undefined,
          ...getRandomCreatedAtAndUpdatedAt(),
          ...getRandomCoherentDataPoints(),
        }
      }
    },
    include: { usedDataSeries: true },
  });
  const nationalV2ScaledDerivedDataSeries = nationalV2ScaledDerivedDataSeriesResult.usedDataSeries[nationalV2ScaledDerivedDataSeriesResult.usedDataSeries.length - 1];

  const nationalV2ScaledDerivedGoal = await prisma.goal.create({
    data: {
      authorId: getRandomUser().id,
      roadmapId: nationalRoadmapV2.id,
      name: RandomTextSE.sentence(3, 1),
      description: RandomTextSE.paragraph(3, 2),
      indicatorParameter: getParameter(),
      isFeatured: true,
      dataSeries: {
        connect: { id: nationalV2ScaledDerivedDataSeries.id },
      },
      recipeUsedId: nationalV2ScaledDerivedRecipe.hash,
    },
  });

  /** 
   * At this point:
   * - Riket (meta roadmap)
   *  - Riket v1 (roadmap)
   *   - v1 goal1 [d1, d2, ..]
   *   - v1 goal2 = goal1 * 2.5
   *  - Riket v2 (roadmap)
   *   - v2 goal1 = copy of v1 goal1
   *   - v2 goal2 = v1 goal2 * 0.4
   */
}

(async () => {
  try {
    await main();
  }
  catch (e) {
    process.exitCode = 1;
    console.error(colors.yellow(`
    Error found while seeding.

    - Do you have a valid database connection?
    - Is the database empty? This seed script must run against an empty database.

    Error thrown:
    `), e);
  }
  finally {
    await prisma.$disconnect();
  }
})()
  .catch((e) => {
    console.error("Fatal error during seeding:", e);
  });