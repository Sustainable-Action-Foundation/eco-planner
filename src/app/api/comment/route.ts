import findTypeFromId from "@/functions/findTypeFromId";
import { getAccessContextById } from "@/fetchers/getUserAccessContext";
import { readableAccessControlWhere, visibleActionsWhere, visibleRoadmapIterationsWhere } from "@/lib/accessFilters";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { JSONValue } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession(await cookies());

  // Validate session
  if (!session.user?.isLoggedIn) {
    return Response.json({ message: 'Unauthenticated, only registered users can comment' },
      { status: 401 },
    );
  }

  const comment = await request.json() as JSONValue;
  if (typeof comment !== "object" || comment == null || Array.isArray(comment) || typeof comment.commentText !== "string" || typeof comment.objectId !== "string") {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 },
    );
  }
  const objectType = await findTypeFromId(comment.objectId);

  if (comment.commentText === "") {
    return Response.json({ message: 'Comment text cannot be empty' },
      { status: 400 },
    );
  }
  if (objectType === undefined) {
    return Response.json({ message: 'Invalid object id' },
      { status: 400 },
    );
  }

  // Commenting requires view access to the commented object (signed-in is already checked)
  const accessContext = await getAccessContextById(session.user.id);
  if (!accessContext) {
    return Response.json({ message: 'Unauthenticated, only registered users can comment' },
      { status: 401 },
    );
  }

  let canView: boolean;
  try {
    switch (objectType) {
      case "action": {
        canView = !!await prisma.actions.findUnique({
          where: { id: comment.objectId, AND: [visibleActionsWhere(accessContext)] },
          select: { id: true },
        });
        break;
      }
      case "goal": {
        canView = !!await prisma.goals.findUnique({
          where: { id: comment.objectId, roadmap_iteration: visibleRoadmapIterationsWhere(accessContext) },
          select: { id: true },
        });
        break;
      }
      case "roadmap": {
        canView = !!await prisma.roadmaps.findUnique({
          where: { id: comment.objectId, access_control: readableAccessControlWhere(accessContext) },
          select: { id: true },
        });
        break;
      }
      case "roadmapIteration": {
        canView = !!await prisma.roadmapIterations.findUnique({
          where: { id: comment.objectId, AND: [visibleRoadmapIterationsWhere(accessContext)] },
          select: { id: true },
        });
        break;
      }
      default: {
        canView = false;
        break;
      }
    }
  } catch {
    canView = false;
  }

  if (!canView) {
    return Response.json({ message: 'You do not have access to the object you are trying to comment on' },
      { status: 403 },
    );
  }

  // Create comment
  try {
    const newComment = await prisma.comments.create({
      data: {
        comment_text: comment.commentText,
        author_id: session.user.id,
        action_id: objectType === "action" ? comment.objectId : undefined,
        goal_id: objectType === "goal" ? comment.objectId : undefined,
        roadmap_id: objectType === "roadmap" ? comment.objectId : undefined,
        roadmap_iteration_id: objectType === "roadmapIteration" ? comment.objectId : undefined,
      },
    });
    // Expire immediately so the commenter sees their own comment on refresh
    revalidateTag(objectType, { expire: 0 });
    return Response.json({ message: 'Comment created', id: newComment.id },
      { status: 200 },
    );
  } catch {
    return Response.json({ message: 'Error creating comment' },
      { status: 500 },
    );
  }
}
