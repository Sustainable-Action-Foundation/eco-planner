import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { AccessControlled, AccessLevel, ClientError, MetaRoadmapInput } from "@/types";
import { Prisma, RoadmapType } from "@prisma/client";
import prisma from "@/prismaClient";
import { revalidateTag } from "next/cache";
import accessChecker from "@/lib/accessChecker";
import pruneOrphans from "@/functions/pruneOrphans";
import { cookies } from "next/headers";

/**
 * Handles POST requests to the metaRoadmap API
 */
export async function POST(request: NextRequest) {
  const [session, metaRoadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<MetaRoadmapInput>,
  ]);

  // Validate request body
  if (!metaRoadmap.name || !metaRoadmap.description) {
    return Response.json({ message: 'Missing required input parameters' },
      { status: 400 }
    );
  }

  // If given roadmap type is invalid or undefined, set it to OTHER
  metaRoadmap.type ??= RoadmapType.OTHER;
  if (!Object.values(RoadmapType).includes(metaRoadmap.type)) {
    metaRoadmap.type = RoadmapType.OTHER;
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    // Get target metaRoadmap (if any) and user
    const [user, targetRoadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      ...(
        metaRoadmap.parentRoadmapId ?
          [
            prisma.metaRoadmap.findUnique({
              where: { id: metaRoadmap.parentRoadmapId },
              include: {
                author: { select: { id: true, username: true } },
                editors: { select: { id: true, username: true } },
                viewers: { select: { id: true, username: true } },
                editGroups: { include: { users: { select: { id: true, username: true } } } },
                viewGroups: { include: { users: { select: { id: true, username: true } } } },
              }
            })
          ] :
          []
      )
    ]);
    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'meta roadmap' });
    }

    // Get the target metaRoadmap (if any) to check if the user has access to it
    if (metaRoadmap.parentRoadmapId) {
      if (!targetRoadmap) {
        throw new Error(ClientError.IllegalParent, { cause: 'meta roadmap' });
      }

      const accessFields: AccessControlled = {
        author: targetRoadmap.author,
        editors: targetRoadmap.editors,
        viewers: targetRoadmap.viewers,
        editGroups: targetRoadmap.editGroups,
        viewGroups: targetRoadmap.viewGroups,
        isPublic: targetRoadmap.isPublic,
      }
      const accessLevel = accessChecker(accessFields, session.user)
      // For now, being able to view a meta roadmap is enough to create a new one working towards it.
      if (accessLevel === AccessLevel.None) {
        throw new Error(ClientError.IllegalParent, { cause: 'meta roadmap' });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      return Response.json({ message: ClientError.IllegalParent },
        { status: 403 }
      );
    } else {
      // If non-error is thrown, log it and return a generic error message
      console.log(error);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Only allow admins to create national roadmaps
  if (metaRoadmap.type == RoadmapType.NATIONAL && !session.user.isAdmin) {
    return Response.json({ message: 'Forbidden; only admins may create national roadmaps. Feel free to send an email to kontakt@sustainable-action.org if you think we should add another.' },
      { status: 403 }
    );
  }

  // Create lists of names for linking
  const editors: { username: string }[] = [];
  for (const name of metaRoadmap.editors || []) {
    editors.push({ username: name });
  }

  const viewers: { username: string }[] = [];
  for (const name of metaRoadmap.viewers || []) {
    viewers.push({ username: name });
  }

  const editGroups: { name: string }[] = [];
  for (const name of metaRoadmap.editGroups || []) {
    editGroups.push({ name: name });
  }

  const viewGroups: { name: string }[] = [];
  for (const name of metaRoadmap.viewGroups || []) {
    viewGroups.push({ name: name });
  }

  // Create the new meta roadmap
  try {
    const newMetaRoadmap = await prisma.metaRoadmap.create({
      data: {
        name: metaRoadmap.name,
        description: metaRoadmap.description,
        type: metaRoadmap.type,
        actor: metaRoadmap.actor,
        parentRoadmap: metaRoadmap.parentRoadmapId ? { connect: { id: metaRoadmap.parentRoadmapId } } : undefined,
        links: {
          create: metaRoadmap.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
        author: { connect: { id: session.user.id } },
        editors: { connect: editors },
        viewers: { connect: viewers },
        editGroups: { connect: editGroups },
        viewGroups: { connect: viewGroups },
        isPublic: metaRoadmap.isPublic,
      },
      select: { id: true }
    });
    // Invalidate old cache
    revalidateTag('roadmap');
    revalidateTag('metaRoadmap');
    // Return the new meta roadmap's ID if successful
    return Response.json({ message: "Roadmap metadata created. \n You will now be sent to another form to add goals and other details for the first version of this roadmap", id: newMetaRoadmap.id },
      { status: 201, headers: { 'Location': `/roadmap/create?metaRoadmapId=${newMetaRoadmap.id}` } }
    );
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2025') {
      return Response.json({ message: 'Failed to connect records. Probably invalid editor, viewer, editGroup, and/or viewGroup name(s)' },
        { status: 400 }
      )
    }
    return Response.json({ message: 'Failed to create roadmap metadata' },
      { status: 500 }
    );
  }
}

/**
 * Handles PUT requests to the metaRoadmap API
 */
export async function PUT(request: NextRequest) {
  const [session, metaRoadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<MetaRoadmapInput & { id: string, timestamp?: number }>,
  ]);

  // Validate request body
  if (!metaRoadmap.id || !metaRoadmap.name || !metaRoadmap.description) {
    return new Response(
      JSON.stringify({ message: 'Missing required input parameters' }),
      { status: 400 }
    );
  }

  // If given roadmap type is invalid, set it to OTHER. If type is undefined leave it be; it wont update the existing value in the database
  if (metaRoadmap.type !== undefined && !Object.values(RoadmapType).includes(metaRoadmap.type)) {
    metaRoadmap.type = RoadmapType.OTHER;
  }

  // Validate session
  if (!session.user?.id) {
    return Response.json({ message: 'Unauthorized' },
      { status: 401, headers: { 'Location': '/login' } }
    );
  }

  try {
    // Get user, current meta roadmap, and target meta roadmap (if any)
    const [user, currentRoadmap, targetRoadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.metaRoadmap.findUnique({
        where: { id: metaRoadmap.id },
        include: {
          author: { select: { id: true, username: true } },
          editors: { select: { id: true, username: true } },
          viewers: { select: { id: true, username: true } },
          editGroups: { include: { users: { select: { id: true, username: true } } } },
          viewGroups: { include: { users: { select: { id: true, username: true } } } },
        }
      }),
      ...(
        metaRoadmap.parentRoadmapId ?
          [
            prisma.metaRoadmap.findUnique({
              where: { id: metaRoadmap.parentRoadmapId },
              include: {
                author: { select: { id: true, username: true } },
                editors: { select: { id: true, username: true } },
                viewers: { select: { id: true, username: true } },
                editGroups: { include: { users: { select: { id: true, username: true } } } },
                viewGroups: { include: { users: { select: { id: true, username: true } } } },
              }
            })
          ] :
          []
      )
    ]);
    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'meta roadmap' });
    }

    // Check if the user has access to the current meta roadmap (returns AccessLevel.None if no current roadmap is found)
    const currentAccess = accessChecker(currentRoadmap, session.user)
    if (currentAccess === AccessLevel.None || currentAccess === AccessLevel.View) {
      throw new Error(ClientError.AccessDenied, { cause: 'meta roadmap' });
    }

    if (metaRoadmap.parentRoadmapId) {
      // If the user is trying to set a parent roadmap, check if they have al least viewing access to it
      const targetAccess = accessChecker(targetRoadmap, session.user)
      if (targetAccess === AccessLevel.None) {
        throw new Error(ClientError.IllegalParent, { cause: 'meta roadmap' });
      }
    }

    // Check if the client's data is stale
    if (!metaRoadmap.timestamp || (currentRoadmap?.updatedAt?.getTime() || 0) > metaRoadmap.timestamp) {
      throw new Error(ClientError.StaleData, { cause: 'meta roadmap' });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      if (error.message == ClientError.StaleData) {
        return Response.json({ message: ClientError.StaleData },
          { status: 409 }
        );
      }
      if (error.message == ClientError.IllegalParent) {
        return Response.json({ message: ClientError.IllegalParent },
          { status: 403 }
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 }
      );
    }
    // If non-error is thrown, log it and return a generic error message
    else {
      console.log(error);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Only allow admins to create national roadmaps
  if (metaRoadmap.type == RoadmapType.NATIONAL && !session.user?.isAdmin) {
    return new Response(
      JSON.stringify({ message: 'Forbidden; only admins can create national roadmaps' }),
      { status: 403 }
    );
  }

  // Create lists of names for linking
  const editors: { username: string }[] = [];
  for (const name of metaRoadmap.editors || []) {
    editors.push({ username: name });
  }

  const viewers: { username: string }[] = [];
  for (const name of metaRoadmap.viewers || []) {
    viewers.push({ username: name });
  }

  const editGroups: { name: string }[] = [];
  for (const name of metaRoadmap.editGroups || []) {
    editGroups.push({ name: name });
  }

  const viewGroups: { name: string }[] = [];
  for (const name of metaRoadmap.viewGroups || []) {
    viewGroups.push({ name: name });
  }

  // Update the meta roadmap
  try {
    const updatedMetaRoadmap = await prisma.metaRoadmap.update({
      where: { id: metaRoadmap.id },
      data: {
        name: metaRoadmap.name,
        description: metaRoadmap.description,
        type: metaRoadmap.type,
        actor: metaRoadmap.actor,
        parentRoadmap: metaRoadmap.parentRoadmapId ? { connect: { id: metaRoadmap.parentRoadmapId } } : undefined,
        links: {
          set: [],
          create: metaRoadmap.links?.map(link => {
            return {
              url: link.url,
              description: link.description || undefined,
            }
          })
        },
        editors: { set: editors },
        viewers: { set: viewers },
        editGroups: { set: editGroups },
        viewGroups: { set: viewGroups },
        isPublic: metaRoadmap.isPublic,
      },
      select: { id: true }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmap');
    revalidateTag('metaRoadmap');
    // Return the updated meta roadmap's ID if successful
    return Response.json({ message: "Roadmap metadata updated", id: updatedMetaRoadmap.id },
      { status: 200, headers: { 'Location': `/metaRoadmap/${updatedMetaRoadmap.id}` } }
    );
  } catch (error) {
    console.log(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code == 'P2025') {
      return Response.json({ message: 'Failed to connect records. Probably invalid editor, viewer, editGroup, and/or viewGroup name(s)' },
        { status: 400 }
      )
    }
    return Response.json({ message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handles DELETE requests to the metaRoadmap API
 */
export async function DELETE(request: NextRequest) {
  const [session, metaRoadmap] = await Promise.all([
    getSession(await cookies()),
    request.json() as Promise<{ id: string }>
  ]);

  // Validate request body
  if (!metaRoadmap.id) {
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
    const [user, currentMetaRoadmap] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, username: true, isAdmin: true, userGroups: true }
      }),
      prisma.metaRoadmap.findUnique({
        where: {
          id: metaRoadmap.id,
          // The user must be admin, or have authored the meta roadmap
          ...(session.user.isAdmin ? {} : { authorId: session.user.id })
        },
      }),
    ]);

    // If no user is found or the found user falsely claims to be an admin, they have a bad session cookie and should be logged out
    if (!user || (session.user.isAdmin && !user.isAdmin)) {
      throw new Error(ClientError.BadSession, { cause: 'meta roadmap' });
    }

    // If the meta roadmap is not found it eiter does not exist or the user has no access to it
    if (!currentMetaRoadmap) {
      throw new Error(ClientError.AccessDenied, { cause: 'meta roadmap' });
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message == ClientError.BadSession) {
        // Remove session to log out. The client should redirect to login page.
        session.destroy();
        return Response.json({ message: ClientError.BadSession },
          { status: 400, headers: { 'Location': '/login' } }
        );
      }
      return Response.json({ message: ClientError.AccessDenied },
        { status: 403 }
      );
    } else {
      console.log(error);
      return Response.json({ message: "Unknown internal server error" },
        { status: 500 }
      );
    }
  }

  // Delete the meta roadmap
  try {
    const deletedMetaRoadmap = await prisma.metaRoadmap.delete({
      where: {
        id: metaRoadmap.id
      },
      select: {
        id: true,
      }
    });
    // Prune any orphaned links and comments
    await pruneOrphans();
    // Invalidate old cache
    revalidateTag('roadmap');
    revalidateTag('metaRoadmap');
    return Response.json({ message: 'Meta roadmap deleted', id: deletedMetaRoadmap.id },
      { status: 200, headers: { 'Location': `/` } }
    );
  } catch (error) {
    console.log(error);
    return Response.json({ message: "Internal server error" },
      { status: 500 }
    );
  }
}