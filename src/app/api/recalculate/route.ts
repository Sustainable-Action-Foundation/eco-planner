import { recalculateGoal } from "@/functions/recalculateGoal";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import prisma from "@/prismaClient";
import { AccessControlled, ClientError } from "@/types";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const [session, requestJson] = await Promise.all([
    getSession(await cookies()),
    (request.json() as Promise<{ id: string }>).catch(() => null)
  ]);

  // Validate request
  if (!requestJson || !requestJson.id) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    // Get user and goal
    const [user, goal] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.goal.findUnique({
        where: {
          id: requestJson.id,
        },
        select: {
          combinationScale: true,
          combinationParents: {
            select: {
              isInverted: true,
              parentGoal: {
                select: {
                  dataSeries: true,
                }
              },
            }
          },
          roadmap: {
            select: {
              author: { select: { id: true, username: true } },
              editors: { select: { id: true, username: true } },
              viewers: { select: { id: true, username: true } },
              editGroups: { include: { users: { select: { id: true, username: true } } } },
              viewGroups: { include: { users: { select: { id: true, username: true } } } },
              isPublic: true,
            }
          },
        }
      })
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'goal' });
    }

    // If no goal is found or if user does not have access, return 403
    // It's fine if the user doesn't have access to the related goals, since a user with access to them created this goal in the first place.
    if (!goal) {
      throw new Error(ClientError.AccessDenied)
    }
    const accessFields: AccessControlled = {
      author: goal.roadmap.author,
      editors: goal.roadmap.editors,
      viewers: goal.roadmap.viewers,
      editGroups: goal.roadmap.editGroups,
      viewGroups: goal.roadmap.viewGroups,
      isPublic: goal.roadmap.isPublic,
    }
    const accessLevel = accessChecker(accessFields, session.user);
    if (!hasEditAccess(accessLevel)) {
      throw new Error(ClientError.AccessDenied)
    }

    // Try to update goal
    const recalculatedData = await recalculateGoal(goal);

    const updatedGoal = await prisma.goal.update({
      where: {
        id: requestJson.id,
      },
      data: {
        dataSeries: {
          update: {
            ...recalculatedData
          }
        }
      },
      select: {
        id: true,
        roadmap: {
          select: { id: true }
        },
      }
    })
    // Invalidate old cache
    revalidateTag('dataSeries');
    // Return the edited goal's ID if successful
    return Response.json({ message: "Data series updated", id: updatedGoal.id },
      { status: 200, headers: { 'Location': `/goal/${updatedGoal.id}` } }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      } else if (error.message == ClientError.AccessDenied) {
        return Response.json({ message: ClientError.AccessDenied },
          { status: 403 }
        );
      }
    }
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}