import findTypeFromId from "@/functions/findTypeFromId";
import { getSession } from "@/lib/session";
import prisma from "@/prisma";
import type { JSONValue } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getSession(await cookies());

  // Validate session
  if (!session.user?.isLoggedIn) {
    return Response.json({ message: 'Unauthenticated, only registered users can comment' },
      { status: 401 }
    );
  }

  const comment = await request.json() as JSONValue;
  if (typeof comment !== "object" || comment == null || Array.isArray(comment) || typeof comment.commentText !== "string" || typeof comment.objectId !== "string") {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }
  const objectType = await findTypeFromId(comment.objectId);

  if (comment.commentText === "") {
    return Response.json({ message: 'Comment text cannot be empty' },
      { status: 400 }
    );
  }
  if (objectType === undefined) {
    return Response.json({ message: 'Invalid object id' },
      { status: 400 }
    );
  }

  // Create comment
  try {
    const newComment = await prisma.comment.create({
      data: {
        commentText: comment.commentText,
        authorId: session.user.id,
        actionId: objectType === "action" ? comment.objectId : undefined,
        goalId: objectType === "goal" ? comment.objectId : undefined,
        roadmapId: objectType === "roadmap" ? comment.objectId : undefined,
      }
    });
    revalidateTag(objectType, 'max')
    return Response.json({ message: 'Comment created', id: newComment.id },
      { status: 200 }
    );
  } catch {
    return Response.json({ message: 'Error creating comment' },
      { status: 500 }
    );
  }
}