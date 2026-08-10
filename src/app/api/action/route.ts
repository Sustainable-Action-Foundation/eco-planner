import type { NextRequest } from "next/server";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { accessControlSelection } from "@/fetchers/inclusionSelectors";
import { parseActionFieldType } from "@/functions/fields";
import pruneOrphans from "@/functions/pruneOrphans";
import { iterationPath } from "@/functions/versionSlug";
import { manualDataSeriesCreateData } from "@/functions/recipe/persistence";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { OrgRole } from "@/lib/prisma/generated";
import { getSession } from "@/lib/session";
import type { ActionInput, UserAccessContext } from "@/types";
import { ClientError } from "@/types/consts";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";

/** True if the user manages the given org (roadmapless actions are maintained by the owning org's managers). */
function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
  return accessContext.isSuperAdmin
    || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
}

/**
 * Handles POST requests to the action API
 */
export async function POST(request: NextRequest) {
  const [session, actionCreate] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<ActionInput>,
  ]);
  const t = await serveTea("api");

  // Validate request body
  if (!actionCreate.name) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  // Actions either sit under a roadmap iteration or (roadmapless) directly under an org
  if (!actionCreate.iterationId && !actionCreate.orgId) {
    return Response.json({ message: t('api:action.missing_parent') },
      { status: 400 },
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  let orgId: string;
  let goalOrgId: string | null = null;

  // Auth
  try {
    const [accessContext, iteration, goal] = await Promise.all([
      getAccessContextById(session.user.id),
      !actionCreate.iterationId
        ? null
        : prisma.roadmapIterations.findUnique({
          where: { id: actionCreate.iterationId },
          select: {
            published_at: true,
            roadmap: { select: { access_control: { select: accessControlSelection } } },
          },
        }),
      !actionCreate.goalId
        ? null
        : prisma.goals.findUnique({
          where: { id: actionCreate.goalId },
          select: {
            roadmap_iteration: {
              select: {
                published_at: true,
                roadmap: { select: { access_control: { select: accessControlSelection } } },
              },
            },
          },
        }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'action' });
    }

    // Also return IllegalParent if a goalId is provided and no valid goal is found
    if (!goal && actionCreate.goalId) {
      throw new Error(ClientError.IllegalParent, { cause: 'action' });
    }

    if (actionCreate.iterationId) {
      // Creating under an iteration requires edit access to it (also covers iterations that don't exist)
      if (!iteration || !hasEditAccess(accessChecker({ access_control: iteration.roadmap.access_control, published_at: iteration.published_at }, accessContext))) {
        throw new Error(ClientError.IllegalParent, { cause: 'action' });
      }
      orgId = iteration.roadmap.access_control.org_id;
    } else {
      // Roadmapless actions (the public action database) are maintained by the owning org's managers
      if (!actionCreate.orgId || !managesOrg(accessContext, actionCreate.orgId)) {
        throw new Error(ClientError.AccessDenied, { cause: 'action' });
      }
      orgId = actionCreate.orgId;
    }

    if (goal) {
      // Creating an effect on the goal requires edit access to the goal
      const goalAccess = accessChecker({ access_control: goal.roadmap_iteration.roadmap.access_control, published_at: goal.roadmap_iteration.published_at }, accessContext);
      if (!hasEditAccess(goalAccess)) {
        throw new Error(ClientError.IllegalParent, { cause: 'action' });
      }
      goalOrgId = goal.roadmap_iteration.roadmap.access_control.org_id;
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (err.message === ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 },
        );
      }
      return Response.json({ message: ClientError.IllegalParent },
        { status: 403 },
      );
    } else {
      // If non-error is thrown, log it and return a generic error message
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // If the data series is invalid, return an error
  if (actionCreate.dataSeries && !isDateValuesWithUnit(actionCreate.dataSeries)) {
    return Response.json(
      { message: t('api:action.invalid_data_series') },
      { status: 400 },
    );
  }

  // Create the action
  try {
    const newActionId = (await prisma.actions.create({
      data: {
        name: actionCreate.name,
        // The indicator parameter places the action in a tree; fall back to the name for a flat placement
        indicator_parameter: actionCreate.indicatorParameter || actionCreate.name,
        start_year: actionCreate.startYear,
        end_year: actionCreate.endYear,
        org: { connect: { id: orgId } },
        roadmap_iteration: actionCreate.iterationId ? { connect: { id: actionCreate.iterationId } } : undefined,
        parent_action: actionCreate.parentActionId ? { connect: { id: actionCreate.parentActionId } } : undefined,
        fields: actionCreate.fields?.length
          ? { createMany: { data: actionCreate.fields.map((field, index) => ({ header: field.header, value: field.value, type: parseActionFieldType(field.type), order: index })) } }
          : undefined,
        effects: !(actionCreate.dataSeries && actionCreate.goalId && goalOrgId)
          ? undefined
          : {
            create: {
              impact_type: actionCreate.impactType,
              // The effect's series belongs to the goal's (deriving) org
              data_series: {
                create: manualDataSeriesCreateData(actionCreate.dataSeries, goalOrgId, session.user.id),
              },
              goal: {
                connect: { id: actionCreate.goalId },
              },
            },
          },
        author: { connect: { id: session.user.id } },
      },
      select: { id: true },
    })).id;

    // Invalidate old cache
    revalidateTag('action', { expire: 0 });
    // Return the new action's ID if successful
    return Response.json({ message: t('api:action.action_created'), id: newActionId },
      { status: 201, headers: { 'Location': `/action/${newActionId}` } },
    );
  }
  catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:action.goal_not_found') },
        { status: 400 },
      );
    }
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles PUT requests to the action API
 */
export async function PUT(request: NextRequest) {
  const [session, action] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<ActionInput>,
  ]);
  const t = await serveTea("api");

  // Validate request body
  if (!action.actionId || !action.name) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }
  if (!action.timestamp) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 409 },
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Auth
  try {
    const [accessContext, currentAction] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.actions.findUnique({
        where: { id: action.actionId },
        select: {
          updated_at: true,
          org_id: true,
          roadmap_iteration: {
            select: {
              published_at: true,
              roadmap: { select: { access_control: { select: accessControlSelection } } },
            },
          },
        },
      }),
    ]);
    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'action' });
    }

    // If no action is found or the user has no edit access to it, return AccessDenied
    const mayEdit = !currentAction ? false
      : currentAction.roadmap_iteration
        ? hasEditAccess(accessChecker({ access_control: currentAction.roadmap_iteration.roadmap.access_control, published_at: currentAction.roadmap_iteration.published_at }, accessContext))
        : managesOrg(accessContext, currentAction.org_id);
    if (!currentAction || !mayEdit) {
      throw new Error(ClientError.AccessDenied, { cause: 'action' });
    }

    // Check if the action has been updated since the client last fetched it
    if ((currentAction.updated_at?.getTime() || 0) > action.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'action' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      if (err.message === ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 },
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 },
      );
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // Update the action
  try {
    const updatedActionId = (await prisma.actions.update({
      where: {
        id: action.actionId,
      },
      data: {
        name: action.name,
        indicator_parameter: action.indicatorParameter,
        start_year: action.startYear,
        end_year: action.endYear,
        // Full replacement of the field set, if provided
        ...(action.fields === undefined ? {} : {
          fields: {
            deleteMany: {},
            createMany: { data: (action.fields ?? []).map((field, index) => ({ header: field.header, value: field.value, type: parseActionFieldType(field.type), order: index })) },
          },
        }),
      },
      select: { id: true },
    })).id;
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('action', { expire: 0 });
    // Return the new action's ID if successful
    return Response.json({ message: t('api:action.action_created'), id: updatedActionId },
      { status: 200, headers: { 'Location': `/action/${updatedActionId}` } },
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
 * Handles DELETE requests to the action API
 */
export async function DELETE(request: NextRequest) {
  const [session, action] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ id: string }>,
  ]);
  const t = await serveTea("api");

  // Validate request body
  if (!action.id) {
    return Response.json({ message: t('api:common.missing_input') },
      { status: 400 },
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  try {
    const [accessContext, currentAction] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.actions.findUnique({
        where: { id: action.id },
        select: {
          org_id: true,
          roadmap_iteration: {
            select: {
              published_at: true,
              roadmap: { select: { access_control: { select: accessControlSelection } } },
            },
          },
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'action' });
    }

    // Deleting requires the same edit access as updating.
    // Also covers actions that don't exist at all.
    const mayDelete = !currentAction ? false
      : currentAction.roadmap_iteration
        ? hasEditAccess(accessChecker({ access_control: currentAction.roadmap_iteration.roadmap.access_control, published_at: currentAction.roadmap_iteration.published_at }, accessContext))
        : managesOrg(accessContext, currentAction.org_id);
    if (!currentAction || !mayDelete) {
      throw new Error(ClientError.AccessDenied, { cause: 'action' });
    }
  }
  catch (err) {
    if (err instanceof Error) {
      if (err.message === ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } },
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 },
      );
    } else {
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // Delete the action
  try {
    const deletedAction = await prisma.actions.delete({
      where: {
        id: action.id,
      },
      select: {
        id: true,
        roadmap_iteration: { select: { roadmap_id: true, version: true } },
      },
    });
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('action', 'max');
    return Response.json({ message: t('api:action.action_deleted'), id: deletedAction.id },
      // Redirect to the parent iteration, or the action database for roadmapless actions
      { status: 200, headers: { 'Location': deletedAction.roadmap_iteration ? iterationPath(deletedAction.roadmap_iteration.roadmap_id, deletedAction.roadmap_iteration.version) : '/' } },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
