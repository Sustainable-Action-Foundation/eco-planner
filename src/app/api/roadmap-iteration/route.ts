import type { NextRequest } from "next/server";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { accessControlSelection } from "@/fetchers/inclusionSelectors";
import pruneOrphans from "@/functions/pruneOrphans";
import { iterationPath } from "@/functions/versionSlug";
import accessChecker, { hasAdminAccess, hasEditAccess } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@PRISMA-NAMESPACE-ONLY";
import { findClaimedSeries } from "@/lib/seriesInvariants";
import { getSession } from "@/lib/session";
import type { JSONValue, RoadmapIterationCreateInput, RoadmapIterationUpdateInput } from "@/types";
import { ClientError } from "@/types/consts";
import { isGoalCreate, isIterationStatus } from "@/types/typeguards";
import { IterationStatus } from "@/lib/prisma/generated";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import roadmapGoalCreator from "./roadmapGoalCreator";

// Type guards
function isRoadmapIterationCreate(iteration: JSONValue): iteration is RoadmapIterationCreateInput {
  return (
    (
      typeof iteration === 'object' &&
      iteration !== null &&
      !Array.isArray(iteration)
    ) &&

    // iterationId?: never;
    (
      iteration.iterationId === undefined
    ) &&

    // description: string | null | undefined;
    (
      typeof iteration.description === 'string' ||
      iteration.description === null ||
      iteration.description === undefined
    ) &&

    // targetVersion: number | null | undefined;
    (
      typeof iteration.targetVersion === 'number' ||
      iteration.targetVersion === null ||
      iteration.targetVersion === undefined
    ) &&

    // status: IterationStatus | undefined;
    (
      isIterationStatus(iteration.status) ||
      iteration.status === undefined
    ) &&

    // roadmapId: string;
    (
      typeof iteration.roadmapId === 'string'
    ) &&

    // goals: GoalCreateFull[] | null | undefined;
    (
      iteration.goals === null ||
      iteration.goals === undefined ||
      (
        // check if array of GoalCreateInput
        Array.isArray(iteration.goals) &&
        iteration.goals.every((goal) =>
          isGoalCreate(goal),
        )
      )
    )
  );
}

function isRoadmapIterationUpdate(iteration: JSONValue): iteration is RoadmapIterationUpdateInput {
  return (
    (
      typeof iteration === 'object' &&
      iteration !== null &&
      !Array.isArray(iteration)
    ) &&

    // iterationId: string;
    (
      typeof iteration.iterationId === 'string'
    ) &&

    // timestamp: number;
    // Used to check for stale data
    (
      typeof iteration.timestamp === 'number'
    ) &&

    // description: string | null | undefined;
    (
      typeof iteration.description === 'string' ||
      iteration.description === null ||
      iteration.description === undefined
    ) &&

    // targetVersion: number | null | undefined;
    (
      typeof iteration.targetVersion === 'number' ||
      iteration.targetVersion === null ||
      iteration.targetVersion === undefined
    ) &&

    // status: IterationStatus | undefined;
    (
      isIterationStatus(iteration.status) ||
      iteration.status === undefined
    ) &&

    // roadmapId?: never;
    (
      iteration.roadmapId === undefined
    ) &&

    // goals: GoalCreateFull[] | null | undefined;
    (
      iteration.goals === null ||
      iteration.goals === undefined ||
      (
        // check if array of GoalCreateInput
        Array.isArray(iteration.goals) &&
        iteration.goals.every((goal) =>
          isGoalCreate(goal),
        )
      )
    )
  );
}

/**
 * Handles POST requests to the roadmap iteration API
 */
export async function POST(request: NextRequest) {
  const [session, iteration] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!isRoadmapIterationCreate(iteration)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  let orgId: string;

  try {
    // Get user context and parent roadmap
    const [accessContext, parentRoadmap] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.roadmaps.findUnique({
        where: { id: iteration.roadmapId },
        select: { access_control: { select: accessControlSelection } },
      }),
    ]);
    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap iteration' });
    }

    // Creating an iteration requires edit access to the parent roadmap.
    // Also covers roadmaps that don't exist at all.
    if (!parentRoadmap || !hasEditAccess(accessChecker(parentRoadmap, accessContext))) {
      throw new Error(ClientError.IllegalParent, { cause: 'roadmap iteration' });
    }

    orgId = parentRoadmap.access_control.org_id;
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

  // No cross-slot sharing: connected baseline series must not already sit in another slot
  const baselineIds = (iteration.goals ?? []).map(goal => goal.baselineId).filter(id => typeof id === 'string');
  if (baselineIds.length > 0) {
    const claimed = await findClaimedSeries(baselineIds);
    if (claimed.length > 0) {
      return Response.json({ message: `Data series already in use in another slot: ${claimed.join(', ')}` },
        { status: 400 },
      );
    }
  }

  // Get the highest existing version number for this roadmap, defaulting to 0
  let latestVersion: number;
  try {
    latestVersion = (await prisma.roadmapIterations.aggregate({
      where: { roadmap_id: iteration.roadmapId },
      _max: { version: true },
    }))._max.version ?? 0;
  } catch {
    return Response.json({ message: t('api:roadmapIteration.failed_fetch_latest') },
      { status: 500 },
    );
  }

  // Create the iteration
  try {
    const newIteration = await prisma.roadmapIterations.create({
      data: {
        description: iteration.description,
        version: latestVersion + 1,
        target_version: iteration.targetVersion,
        // Drafts are only visible to users with edit access; published_at records the first publication
        status: iteration.status ?? IterationStatus.DRAFT,
        published_at: iteration.status && iteration.status !== IterationStatus.DRAFT ? new Date() : null,
        author: { connect: { id: session.user.id } },
        roadmap: { connect: { id: iteration.roadmapId } },
        goals: {
          create: roadmapGoalCreator(iteration, session.user.id, orgId),
        },
      },
      select: { id: true, roadmap_id: true, version: true },
    });
    // Invalidate old cache
    revalidateTag('roadmapIteration', { expire: 0 });
    // Return the new iteration's ID if successful
    return Response.json({ message: t('api:roadmapIteration.iteration_created'), id: newIteration.id },
      { status: 201, headers: { 'Location': iterationPath(newIteration.roadmap_id, newIteration.version) } },
    );
  }
  catch (err) {
    // Custom error if there are errors in the nested goal creation
    if (err instanceof Error) {
      if (err.cause === 'nestedGoalCreation') {
        return Response.json({ message: err.message },
          { status: 400 },
        );
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:roadmapIteration.failed_record_connection') },
        { status: 400 },
      );
    }
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles PUT requests to the roadmap iteration API
 */
export async function PUT(request: NextRequest) {
  const [session, iteration] = await Promise.all([
    getSession(await cookies()),
    // The version number is not allowed to be changed
    request.json() as Promise<JSONValue>,
  ]);
  const t = await serveTea("api");

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: t('api:common.unauthorized') },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  // Validate request body
  if (!isRoadmapIterationUpdate(iteration)) {
    return Response.json({ message: t('api:common.invalid_request_body') },
      { status: 400 },
    );
  }

  let orgId: string;
  // Whether this write is the version's first step out of draft (stamps published_at)
  // eslint-disable-next-line no-useless-assignment -- the catch below returns, but the linter can't tell
  let firstPublication = false;

  try {
    // Get user context and current iteration
    const [accessContext, currentIteration] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.roadmapIterations.findUnique({
        where: { id: iteration.iterationId },
        select: {
          updated_at: true,
          status: true,
          published_at: true,
          roadmap: { select: { access_control: { select: accessControlSelection } } },
        },
      }),
    ]);
    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap iteration' });
    }

    // Check if the iteration exists and the user has edit access to it
    const access = accessChecker(
      currentIteration ? { access_control: currentIteration.roadmap.access_control, status: currentIteration.status } : null,
      accessContext,
    );
    if (!currentIteration || !hasEditAccess(access)) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap iteration' });
    }

    orgId = currentIteration.roadmap.access_control.org_id;
    firstPublication = currentIteration.published_at === null && !!iteration.status && iteration.status !== IterationStatus.DRAFT;

    // Check if the client's data is stale
    if (!iteration.timestamp || (currentIteration.updated_at?.getTime() ?? 0) > iteration.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'roadmap iteration' });
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
      // If non-error is thrown, log it and return a generic error message
      console.error(err);
      return Response.json({ message: t('api:common.unknown_server_error') },
        { status: 500 },
      );
    }
  }

  // No cross-slot sharing: connected baseline series must not already sit in another slot
  const baselineIds = (iteration.goals ?? []).map(goal => goal.baselineId).filter(id => typeof id === 'string');
  if (baselineIds.length > 0) {
    const claimed = await findClaimedSeries(baselineIds);
    if (claimed.length > 0) {
      return Response.json({ message: `Data series already in use in another slot: ${claimed.join(', ')}` },
        { status: 400 },
      );
    }
  }

  // Update the iteration
  try {
    const updatedIteration = await prisma.roadmapIterations.update({
      where: { id: iteration.iterationId },
      data: {
        description: iteration.description,
        target_version: iteration.targetVersion,
        // undefined leaves the status unchanged; leaving draft for the first time stamps published_at
        status: iteration.status,
        ...(firstPublication ? { published_at: new Date() } : {}),
        goals: {
          create: roadmapGoalCreator(iteration, session.user.id, orgId),
        },
      },
      select: { id: true, roadmap_id: true, version: true },
    });
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmapIteration', { expire: 0 });
    // Return the iteration's ID if successful
    return Response.json({ message: t('api:roadmapIteration.iteration_updated'), id: updatedIteration.id },
      { status: 200, headers: { 'Location': iterationPath(updatedIteration.roadmap_id, updatedIteration.version) } },
    );
  }
  catch (err) {
    console.error(err);
    // Custom error if there are errors in the nested goal creation
    if (err instanceof Error) {
      if (err.cause === 'nestedGoalCreation') {
        return Response.json({ message: err.message },
          { status: 400 },
        );
      }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json({ message: t('api:roadmapIteration.failed_record_connection') },
        { status: 400 },
      );
    }
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}

/**
 * Handles DELETE requests to the roadmap iteration API
 */
export async function DELETE(request: NextRequest) {
  const [session, iteration] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ id: string }>,
  ]);
  const t = await serveTea("api");

  // Validate request body
  if (!iteration.id) {
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
    const [accessContext, currentIteration] = await Promise.all([
      getAccessContextById(session.user.id),
      prisma.roadmapIterations.findUnique({
        where: { id: iteration.id },
        select: {
          status: true,
          roadmap: { select: { access_control: { select: accessControlSelection } } },
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be a super admin, they have a bad session cookie and should be logged out
    if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'roadmap iteration' });
    }

    // Drafts may be deleted with edit access; published iterations are history and
    // deleting them requires admin access (org manager or super admin).
    // Also covers iterations that don't exist at all.
    const access = accessChecker(
      currentIteration ? { access_control: currentIteration.roadmap.access_control, status: currentIteration.status } : null,
      accessContext,
    );
    const mayDelete = currentIteration?.status === IterationStatus.DRAFT ? hasEditAccess(access) : hasAdminAccess(access);
    if (!currentIteration || !mayDelete) {
      throw new Error(ClientError.AccessDenied, { cause: 'roadmap iteration' });
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

  // Delete the iteration
  try {
    const deletedIteration = await prisma.roadmapIterations.delete({
      where: {
        id: iteration.id,
      },
      select: {
        id: true,
        roadmap_id: true,
      },
    });
    // Prune any orphaned comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmapIteration', 'max');
    return Response.json({ message: t('api:roadmapIteration.iteration_deleted'), id: deletedIteration.id },
      // Redirect to the parent roadmap
      { status: 200, headers: { 'Location': `/roadmap/${deletedIteration.roadmap_id}` } },
    );
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: t('api:common.server_error') },
      { status: 500 },
    );
  }
}
