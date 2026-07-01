// Seeds goals and their data series. Embodies the app's philosophy that data series
// are derived through recipes:
//   - National v1 goals hold manually-entered "base" series (no recipe).
//   - National v2 goals derive their series 1:1 from the matching v1 goal (recipe).
//   - Uppsala goals derive their series from national goals by a constant (recipe).

import { prisma } from "@/lib/prisma";
import type { SeededGoal, SeededSeries, SeededUsers } from "./helpers.ts";
import {
  RandomTextSE,
  chance,
  createInitialBaseline,
  createManualSeries,
  createSuggestionRecipes,
  deriveByScalar,
  deriveOneToOne,
  getRandomCoherentDateValues,
  getRandomCreatedAtAndUpdatedAt,
  getRandomUnit,
  makeRandomComments,
  makeRandomLinks,
  randomIndicatorParameter,
  randomInt,
  randomOf,
} from "./helpers.ts";
import type { SeededRoadmaps } from "./seed-roadmaps.ts";

export type SeededGoals = {
  nationalV1: SeededGoal[];
  nationalV2: SeededGoal[];
  uppsalaV1: SeededGoal[];
};

const NATIONAL_GOAL_COUNT = 10;
const UPPSALA_GOAL_COUNT = 6;
const TAG_POOL = ["klimat", "energi", "transport", "industri", "byggnation", "avfall", "jordbruk"] as const;

export async function seedGoals(users: SeededUsers, roadmaps: SeededRoadmaps["roadmaps"]): Promise<SeededGoals> {
  /*
   * National v1 - base goals with manually-entered series and suggestion recipes for inheritance.
   */
  const nationalV1: SeededGoal[] = [];
  for (let i = 0; i < NATIONAL_GOAL_COUNT; i++) {
    const authorId = randomOf(users.all).id;
    const series = await createManualSeries(authorId, getRandomCoherentDateValues(), getRandomUnit());
    const baseline = await createInitialBaseline(authorId, series);
    const historical = chance(0.3)
      ? await createManualSeries(authorId, getRandomCoherentDateValues(), series.unit)
      : undefined;
    const recipeSuggestionIds = await createSuggestionRecipes(series);

    nationalV1.push(await createGoal(users, {
      roadmapId: roadmaps.nationalV1.id,
      series,
      baseline,
      historical,
      recipeSuggestionIds,
    }));
  }

  /*
   * National v2 - each goal derives its series 1:1 from the matching v1 goal.
   */
  const nationalV2: SeededGoal[] = [];
  for (const parent of nationalV1) {
    const authorId = randomOf(users.all).id;
    const series = await deriveOneToOne(authorId, parent.series, "1:1 från föregående version");
    const recipeSuggestionIds = await createSuggestionRecipes(series);

    nationalV2.push(await createGoal(users, {
      roadmapId: roadmaps.nationalV2.id,
      series,
      recipeSuggestionIds,
    }));
  }

  /*
   * Uppsala v1 - a subset of national goals scaled down to the region by a constant.
   */
  const uppsalaV1: SeededGoal[] = [];
  for (const parent of nationalV1.slice(0, UPPSALA_GOAL_COUNT)) {
    const authorId = randomOf(users.all).id;
    const scalar = 1 + Math.random() * 9;
    const series = await deriveByScalar(authorId, parent.series, scalar, "Skalning från riket till Uppsala län");

    uppsalaV1.push(await createGoal(users, { roadmapId: roadmaps.uppsalaV1.id, series }));
  }

  return { nationalV1, nationalV2, uppsalaV1 };
}

type GoalOptions = {
  roadmapId: string;
  series: SeededSeries;
  baseline?: SeededSeries | undefined;
  historical?: SeededSeries | undefined;
  recipeSuggestionIds?: string[] | undefined;
};

/** Creates a goal wired to an already-created data series, plus tags, comments and links. */
async function createGoal(users: SeededUsers, options: GoalOptions): Promise<SeededGoal> {
  const goal = await prisma.goal.create({
    data: {
      name: RandomTextSE.sentence(3, 1),
      description: RandomTextSE.paragraph(randomInt(1, 3)),
      indicatorParameter: randomIndicatorParameter(),
      isFeatured: chance(0.3),
      author: { connect: { id: randomOf(users.all).id } },
      roadmap: { connect: { id: options.roadmapId } },
      ...getRandomCreatedAtAndUpdatedAt(),
      dataSeries: { connect: { id: options.series.id } },
      ...(options.baseline ? { baseline: { connect: { id: options.baseline.id } } } : {}),
      ...(options.historical ? { historical: { connect: { id: options.historical.id } } } : {}),
      ...(options.recipeSuggestionIds?.length
        ? { recipeSuggestions: { connect: options.recipeSuggestionIds.map(id => ({ id })) } }
        : {}),
      tags: { connectOrCreate: pickTags() },
      comments: { createMany: { data: makeRandomComments(users, randomInt(0, 8)) } },
      links: { create: makeRandomLinks(randomInt(0, 3)) },
    },
    select: { id: true },
  });

  return { id: goal.id, roadmapId: options.roadmapId, series: options.series };
}

/** Picks a random subset of tags as connectOrCreate payloads (tags are shared by name across goals). */
function pickTags() {
  const count = randomInt(0, 3);
  const shuffled = [...TAG_POOL].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map(name => ({ where: { name }, create: { name } }));
}
