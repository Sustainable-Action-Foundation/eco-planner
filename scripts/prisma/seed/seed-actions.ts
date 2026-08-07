// Seeds actions and the effects that connect them to goals. Covers action inheritance
// (v2 actions inherit from v1), orphaned actions (no effects), a roadmapless action
// (the public action database), free-form fields, and comments.

import { prisma } from "@/lib/prisma";
import { ActionImpactType } from "@/lib/prisma/generated";
import { ActionFieldHeaders, defaultActionFieldType } from "@/functions/fields";
import { Recipe } from "@/functions/recipe";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { parseUnit } from "@/functions/unit";
import type { SeededGoal, SeededUsers } from "./helpers.ts";
import {
  RandomTextSE,
  chance,
  getRandomCoherentDateValues,
  getRandomCreatedAtAndUpdatedAt,
  getRandomUnit,
  makeRandomComments,
  randomIndicatorParameter,
  randomInt,
  randomOf,
} from "./helpers.ts";
import type { SeededRoadmaps } from "./seed-roadmaps.ts";
import type { SeededGoals } from "./seed-goals.ts";

export async function seedActions(
  users: SeededUsers,
  iterations: SeededRoadmaps["iterations"],
  goals: SeededGoals,
): Promise<void> {
  /*
   * National v1 - a few actions, most affecting goals, one left orphaned (no effects).
   */
  const nationalV1Actions: string[] = [];
  for (let i = 0; i < 4; i++) {
    const actionId = await createAction(users, iterations.nationalV1.id, {});
    nationalV1Actions.push(actionId);
    // Leave the last action orphaned to exercise actions without effects.
    if (i < 3) await addEffects(users, actionId, goals.nationalV1);
  }

  /*
   * National v2 - actions that inherit from the v1 actions and affect v2 goals.
   */
  for (let i = 0; i < 3; i++) {
    const actionId = await createAction(users, iterations.nationalV2.id, { parentActionId: nationalV1Actions[i] });
    await addEffects(users, actionId, goals.nationalV2);
  }

  /*
   * Uppsala v1 - regional actions affecting the regional goals.
   */
  for (let i = 0; i < 2; i++) {
    const actionId = await createAction(users, iterations.uppsalaV1.id, {});
    await addEffects(users, actionId, goals.uppsalaV1);
  }

  /*
   * One roadmapless action: the org-maintained public action database.
   */
  await createAction(users, null, {});
}

/** Creates an action with a random spread of free-form fields and comments. */
async function createAction(
  users: SeededUsers,
  iterationId: string | null,
  options: { parentActionId?: string },
): Promise<string> {
  const startYear = randomInt(2020, 2030);

  // The old fixed columns live on as ActionFields rows with canonical headers
  const fields: { header: string, value: string }[] = [];
  if (chance(0.8)) fields.push({ header: ActionFieldHeaders.Description, value: RandomTextSE.paragraph(randomInt(1, 2)) });
  if (chance(0.5)) fields.push({ header: ActionFieldHeaders.CostEfficiency, value: RandomTextSE.sentence(randomInt(3, 8)) });
  if (chance(0.6)) fields.push({ header: ActionFieldHeaders.ExpectedOutcome, value: RandomTextSE.paragraph(1) });
  if (chance(0.5)) fields.push({ header: ActionFieldHeaders.RelevantActors, value: RandomTextSE.words(randomInt(1, 3)) });
  for (const tag of ["sufficiency", "efficiency", "renewable"]) {
    if (chance(0.4)) fields.push({ header: ActionFieldHeaders.Tag, value: tag });
  }

  const action = await prisma.actions.create({
    data: {
      name: RandomTextSE.sentence(3, 1).replace(/\.$/, ""),
      indicator_parameter: randomIndicatorParameter(),
      start_year: startYear,
      end_year: chance(0.7) ? startYear + randomInt(1, 20) : null,
      org: { connect: { id: users.org.id } },
      fields: fields.length
        ? { createMany: { data: fields.map(field => ({ ...field, type: defaultActionFieldType(field.header) })) } }
        : undefined,
      author: { connect: { id: randomOf(users.all).id } },
      ...(iterationId ? { roadmap_iteration: { connect: { id: iterationId } } } : {}),
      ...(options.parentActionId ? { parent_action: { connect: { id: options.parentActionId } } } : {}),
      ...getRandomCreatedAtAndUpdatedAt(),
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
    const dateValues = getRandomCoherentDateValues();
    await prisma.effects.create({
      data: {
        action: { connect: { id: actionId } },
        goal: { connect: { id: goal.id } },
        impact_type: randomOf([ActionImpactType.PERCENT, ActionImpactType.ABSOLUTE, ActionImpactType.DELTA]),
        ...getRandomCreatedAtAndUpdatedAt(),
        data_series: {
          create: {
            author: { connect: { id: authorId } },
            org: { connect: { id: users.org.id } },
            ...(unit === undefined ? {} : { unit }),
            values: { createMany: { data: dateValuesToDBDateRecord(dateValues) } },
            // Manual entry: the series is produced by an inline manual recipe
            recipe_used: {
              create: {
                recipe: Recipe.fromManualDateValues({ dateValues, unit: parseUnit(unit === undefined ? "" : unit) }).serialize(),
                org: { connect: { id: users.org.id } },
              },
            },
          },
        },
      },
    });
  }
}
