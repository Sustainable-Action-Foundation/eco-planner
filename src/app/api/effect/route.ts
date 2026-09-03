import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { accessControlSelection } from "@/fetchers/inclusionSelectors";
import { Recipe } from "@/functions/recipe/recipe";
import { manualDataSeriesCreateData } from "@/functions/recipe/persistence";
import { dateValuesToDBDateRecord } from "@/functions/recipe/vectorAndMaskUtils";
import { serializeUnit } from "@/functions/unit";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { ActionImpactType, OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import type { EffectInput, JSONValue, UserAccessContext } from "@/types";
import { ClientError } from "@/types/consts";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// Typeguard and check if the request body is valid
function isEffect(effect: JSONValue): effect is EffectInput {
  return (
    typeof effect === 'object'
    && effect != null
    && !(effect instanceof Array)

    && typeof effect.actionId === 'string'
    && typeof effect.goalId === 'string'

    && "dataSeries" in effect
    && effect.dataSeries !== undefined
    && isDateValuesWithUnit(effect.dataSeries)

    && (
      effect.impactType === undefined
      || Object.values(ActionImpactType).includes(effect.impactType as ActionImpactType)
    )
  );
}

/** The selection needed to run the edit-access checks on an effect's action and goal. */
const effectParentsSelection = {
  action: {
    select: {
      org_id: true,
      roadmap_iteration: {
        select: {
          status: true,
          roadmap: { select: { access_control: { select: accessControlSelection } } },
        },
      },
    },
  },
  goal: {
    select: {
      roadmap_iteration: {
        select: {
          status: true,
          roadmap: { select: { access_control: { select: accessControlSelection } } },
        },
      },
    },
  },
} satisfies Prisma.EffectsSelect;

type EffectParents = Prisma.EffectsGetPayload<{ select: typeof effectParentsSelection }>;

/**
 * Edit access to an effect requires edit access to both the action and the goal.
 * Roadmapless actions (the public action database) are editable by the owning org's managers.
 */
function mayEditEffectParents(parents: Pick<EffectParents, "action" | "goal">, accessContext: UserAccessContext): boolean {
  const actionEditable = parents.action.roadmap_iteration
    ? hasEditAccess(accessChecker({ access_control: parents.action.roadmap_iteration.roadmap.access_control, status: parents.action.roadmap_iteration.status }, accessContext))
    : (accessContext.isSuperAdmin || accessContext.memberships.some(membership => membership.orgId === parents.action.org_id && membership.role === OrgRole.MANAGER));
  const goalEditable = hasEditAccess(accessChecker({ access_control: parents.goal.roadmap_iteration.roadmap.access_control, status: parents.goal.roadmap_iteration.status }, accessContext));
  return actionEditable && goalEditable;
}

/**
 * Handles POST requests to the effect API
 */
export async function POST(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!isEffect(effect)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  let goalOrgId: string;

  // Get user and check permissions
  try {
    const [accessContext, action, goal] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.actions.findUnique({
        where: { id: effect.actionId },
        select: effectParentsSelection.action.select,
      }),
      prisma.goals.findUnique({
        where: { id: effect.goalId },
        select: effectParentsSelection.goal.select,
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // Check access levels
    if (!action || !goal) {
      throw new Error(ClientError.IllegalParent, { cause: 'effect' });
    }

    if (!mayEditEffectParents({ action, goal }, accessContext)) {
      throw new Error(ClientError.IllegalParent, { cause: 'effect' });
    }

    // The effect's series belongs to the goal's (deriving) org
    goalOrgId = goal.roadmap_iteration.roadmap.access_control.org_id;
  }
  catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case ClientError.BadSession: {
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } },
          );
        }
        case ClientError.IllegalParent: {
          return Response.json({ message: ClientError.IllegalParent },
            { status: 403 },
          );
        }
        default: {
          return Response.json({ message: t('api:common.unknown_error') },
            { status: 500 },
          );
        }
      }
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_error') },
        { status: 500 },
      );
    }
  }

  // Create the effect
  try {
    const newEffect = await prisma.effects.create({
      data: {
        action: { connect: { id: effect.actionId } },
        goal: { connect: { id: effect.goalId } },
        impact_type: effect.impactType,
        data_series: {
          create: manualDataSeriesCreateData(effect.dataSeries, goalOrgId, session.user.id),
        },
      },
    });
    // Invalidate old cache
    revalidateTag('action', { expire: 0 });
    revalidateTag('goal', { expire: 0 });
    // Return success
    return Response.json({ message: t('api:effect.effect_created'), actionId: newEffect.action_id, goalId: newEffect.goal_id },
      { status: 201 },
    );
  }
  catch (err) {
    // Unique constraint error
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return Response.json({ message: t('api:effect.effect_already_exists') },
        { status: 409 },
      );
    }
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles PUT requests to the effect API
 */
export async function PUT(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  if (!isEffect(effect)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  if (!effect.timestamp) {
    return Response.json({ message: t('api:common.stale_data') },
      { status: 409 },
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  let goalOrgId: string;

  // Get user and check permissions
  try {
    const [accessContext, currentEffect] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.effects.findUnique({
        where: { id: { action_id: effect.actionId, goal_id: effect.goalId } },
        select: {
          updated_at: true,
          ...effectParentsSelection,
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // Check access
    if (!currentEffect || !mayEditEffectParents(currentEffect, accessContext)) {
      throw new Error(ClientError.AccessDenied, { cause: 'effect' });
    }

    goalOrgId = currentEffect.goal.roadmap_iteration.roadmap.access_control.org_id;

    // Check if the data is stale
    if (currentEffect.updated_at.getTime() > effect.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'effect' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case ClientError.BadSession: {
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } },
          );
        }
        case ClientError.AccessDenied: {
          return Response.json({ message: ClientError.AccessDenied },
            { status: 403 },
          );
        }
        case ClientError.StaleData: {
          return Response.json({ message: ClientError.StaleData },
            { status: 409 },
          );
        }
        default: {
          return Response.json({ message: t('api:common.unknown_error') },
            { status: 500 },
          );
        }
      }
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_error') },
        { status: 500 },
      );
    }
  }

  // Update the effect
  try {
    const updatedEffect = await prisma.effects.update({
      where: { id: { action_id: effect.actionId, goal_id: effect.goalId } },
      data: {
        impact_type: effect.impactType,
        data_series: {
          upsert: {
            create: manualDataSeriesCreateData(effect.dataSeries, goalOrgId, session.user.id),
            update: {
              values: {
                deleteMany: {},
                createMany: { data: dateValuesToDBDateRecord(effect.dataSeries.dateValues) },
              },
              unit: serializeUnit(effect.dataSeries.unit), // db keeps the legacy convention
              // Keep the producing manual recipe in sync with the entered values,
              // so recalculating the series doesn't resurrect stale data
              recipe_used: {
                update: { recipe: Recipe.fromManualDateValues(effect.dataSeries).serialize() },
              },
            },
          },
        },
      },
    });
    // Invalidate old cache
    revalidateTag('action', { expire: 0 });
    revalidateTag('goal', { expire: 0 });
    // Return success
    return Response.json({ message: t('api:effect.effect_updated'), actionId: updatedEffect.action_id, goalId: updatedEffect.goal_id },
      { status: 200 },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles DELETE requests to the effect API
 */
export async function DELETE(request: NextRequest) {
  const [session, effect] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Typeguard and check if the request body is valid
  // For delete, only expect actionId and goalId (but allow other fields)
  function isEffectDelete(effect: JSONValue): effect is { actionId: string, goalId: string } {
    return (
      // effect should be an object
      (typeof effect === 'object' &&
        effect != null &&
        !(effect instanceof Array) &&
        // actionId and goalId should be strings
        typeof effect.actionId === 'string' && typeof effect.goalId === 'string')
    );
  }

  if (!isEffectDelete(effect)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Get user and check permissions
  try {
    const [accessContext, currentEffect] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.effects.findUnique({
        where: { id: { action_id: effect.actionId, goal_id: effect.goalId } },
        select: effectParentsSelection,
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'effect' });
    }

    // Deleting requires the same edit access as updating.
    // Also covers effects that don't exist at all.
    if (!currentEffect || !mayEditEffectParents(currentEffect, accessContext)) {
      throw new Error(ClientError.AccessDenied, { cause: 'effect' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      switch (err.message) {
        case ClientError.BadSession: {
          session.destroy();
          return Response.json({ message: ClientError.BadSession },
            { status: 400, headers: { 'Location': '/login' } },
          );
        }
        case ClientError.AccessDenied: {
          return Response.json({ message: ClientError.AccessDenied },
            { status: 403 },
          );
        }
        default: {
          return Response.json({ message: t('api:common.unknown_error') },
            { status: 500 },
          );
        }
      }
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_error') },
        { status: 500 },
      );
    }
  }

  // Delete the effect
  try {
    const deletedEffect = await prisma.effects.delete({
      where: { id: { action_id: effect.actionId, goal_id: effect.goalId } },
    });
    // Invalidate old cache
    revalidateTag('action', 'max');
    revalidateTag('goal', 'max');
    // Return success
    return Response.json({ message: t('api:effect.effect_deleted'), actionId: deletedEffect.action_id, goalId: deletedEffect.goal_id },
      { status: 200 },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
