// Seeds actions and the effects that connect them to goals. Covers action inheritance
// (v2 actions inherit from v1), orphaned actions (no effects), links and comments.

import { prisma } from "@/lib/prisma";
import { ActionImpactType } from "@/lib/prisma/generated";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import type { SeededGoal, SeededUsers } from "./helpers.ts";
import {
  RandomTextSE,
  chance,
  getRandomCoherentDateValues,
  getRandomCreatedAtAndUpdatedAt,
  getRandomUnit,
  makeRandomComments,
  makeRandomLinks,
  randomInt,
  randomOf,
} from "./helpers.ts";
import type { SeededRoadmaps } from "./seed-roadmaps.ts";
import type { SeededGoals } from "./seed-goals.ts";

export async function seedActions(
  users: SeededUsers,
  roadmaps: SeededRoadmaps["roadmaps"],
  goals: SeededGoals,
): Promise<void> {
  /*
   * National v1 - a few actions, most affecting goals, one left orphaned (no effects).
   */
  const nationalV1Actions: string[] = [];
  for (let i = 0; i < 4; i++) {
    const actionId = await createAction(users, roadmaps.nationalV1.id, {});
    nationalV1Actions.push(actionId);
    // Leave the last action orphaned to exercise actions without effects.
    if (i < 3) await addEffects(users, actionId, goals.nationalV1);
  }

  /*
   * National v2 - actions that inherit from the v1 actions and affect v2 goals.
   */
  for (let i = 0; i < 3; i++) {
    const actionId = await createAction(users, roadmaps.nationalV2.id, { parentActionId: nationalV1Actions[i] });
    await addEffects(users, actionId, goals.nationalV2);
  }

  /*
   * Uppsala v1 - regional actions affecting the regional goals.
   */
  for (let i = 0; i < 2; i++) {
    const actionId = await createAction(users, roadmaps.uppsalaV1.id, {});
    await addEffects(users, actionId, goals.uppsalaV1);
  }
}

/** Creates an action with a random spread of fields, links and comments. */
async function createAction(
  users: SeededUsers,
  roadmapId: string,
  options: { parentActionId?: string },
): Promise<string> {
  const startYear = randomInt(2020, 2030);
  const action = await prisma.action.create({
    data: {
      name: RandomTextSE.sentence(3, 1).replace(/\.$/, ""),
      description: chance(0.8) ? RandomTextSE.paragraph(randomInt(1, 2)) : null,
      startYear,
      endYear: chance(0.7) ? startYear + randomInt(1, 20) : null,
      costEfficiency: chance(0.5) ? RandomTextSE.sentence(randomInt(3, 8)) : null,
      expectedOutcome: chance(0.6) ? RandomTextSE.paragraph(1) : null,
      projectManager: chance(0.5) ? RandomTextSE.words(2) : null,
      relevantActors: chance(0.5) ? RandomTextSE.words(randomInt(1, 3)) : null,
      isSufficiency: chance(0.4),
      isEfficiency: chance(0.4),
      isRenewables: chance(0.4),
      author: { connect: { id: randomOf(users.all).id } },
      roadmap: { connect: { id: roadmapId } },
      ...(options.parentActionId ? { parentAction: { connect: { id: options.parentActionId } } } : {}),
      ...getRandomCreatedAtAndUpdatedAt(),
      links: { create: makeRandomLinks(randomInt(0, 2)) },
      comments: { createMany: { data: makeRandomComments(users, randomInt(0, 6)) } },
    },
    select: { id: true },
  });
  return action.id;
}

/** Connects an action to one or two random goals via effects, each with its own impact data series. */
async function addEffects(users: SeededUsers, actionId: string, goalPool: SeededGoal[]): Promise<void> {
  if (goalPool.length === 0) return;

  const targets = [...goalPool].sort(() => Math.random() - 0.5).slice(0, randomInt(1, 2));
  for (const goal of targets) {
    const authorId = randomOf(users.all).id;
    const unit = getRandomUnit();
    await prisma.effect.create({
      data: {
        action: { connect: { id: actionId } },
        goal: { connect: { id: goal.id } },
        impactType: randomOf([ActionImpactType.PERCENT, ActionImpactType.ABSOLUTE, ActionImpactType.DELTA]),
        ...getRandomCreatedAtAndUpdatedAt(),
        dataSeries: {
          create: {
            author: { connect: { id: authorId } },
            ...(unit === undefined ? {} : { unit }),
            values: { createMany: { data: dateValuesToDBDateRecord(getRandomCoherentDateValues()) } },
          },
        },
      },
    });
  }
}
