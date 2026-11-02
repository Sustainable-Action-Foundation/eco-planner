import { isLikeAspect } from "@/functions/likeAspect";
import { getAccessContextFor } from "@/fetchers/getUserAccessContext";
import { visibleRoadmapIterationsWHERE } from "@/lib/accessFilters";
import serveTea from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { JSONValue } from "@/types";
import { LikeAspect } from "@/types/enums";
import { isStandardObject } from "@/types/typeguards";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

/**
 * A like on a goal: POST puts it there, DELETE takes it away. Both take
 * `{ goalId }` and are idempotent, so a double click can't error or double
 * count. Liking needs a signed-in user who can read the goal.
 *
 * POST may also carry `aspects`, a list of `LikeAspect`s: the kinds of
 * rådighet the liker sees for the goal. Given, it replaces the like's aspect
 * set (`[]` clears it) and creates the like if there was none, since aspects
 * only exist on a like; left out, the aspects stay as they were. DELETE drops
 * the aspects with the like. Responses carry `{ liked, likeCount, aspects }`.
 */
export async function POST(request: NextRequest) {
  return setLike(request, true);
}

export async function DELETE(request: NextRequest) {
  return setLike(request, false);
}

async function setLike(request: NextRequest, liked: boolean) {
  const [session, body, t] = await Promise.all([
    getSession(await cookies()),
    (request.json() as Promise<JSONValue>).catch(() => null),
    serveTea("api"),
  ]);

  if (!session.user?.isLoggedIn || !session.user.id) {
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  if (!isStandardObject(body) || Array.isArray(body) || !("goalId" in body) || typeof body.goalId !== "string" || !body.goalId) {
    return Response.json({ message: t("api:common.invalid_request_body") },
      { status: 400 },
    );
  }
  const goalId = body.goalId;

  // Aspects only make sense on a like; a DELETE ignores them
  let aspects: LikeAspect[] | undefined;
  if (liked && "aspects" in body && body.aspects !== undefined) {
    if (!Array.isArray(body.aspects)) {
      return Response.json({ message: t("api:common.invalid_request_body") },
        { status: 400 },
      );
    }
    const unknownAspect = body.aspects.find(aspect => !isLikeAspect(aspect));
    if (unknownAspect !== undefined) {
      return Response.json({ message: t("api:goalLike.invalid_aspect", { aspect: JSON.stringify(unknownAspect) }) },
        { status: 400 },
      );
    }
    aspects = [...new Set(body.aspects as LikeAspect[])];
  }

  const accessContext = await getAccessContextFor(session.user);
  // No user behind the session cookie: log them out
  if (!accessContext || (session.user.isSuperAdmin && !accessContext.isSuperAdmin)) {
    session.destroy();
    return Response.json({ message: t("api:common.unauthorized") },
      { status: 401, headers: { 'Location': '/login' } },
    );
  }

  try {
    // Liking requires view access; a goal the user can't see doesn't exist to them
    const goal = await prisma.goals.findUnique({
      where: { id: goalId, roadmap_iteration: visibleRoadmapIterationsWHERE(accessContext) },
      select: { id: true },
    });
    if (!goal) {
      return Response.json({ message: t("api:goalLike.not_found") },
        { status: 404 },
      );
    }

    const key = { goal_id: goalId, user_id: accessContext.id };
    if (liked) {
      await prisma.goalLikes.upsert({
        where: { goal_id_user_id: key },
        create: key,
        update: {},
      });
      if (aspects) {
        await prisma.$transaction([
          prisma.goalLikeAspects.deleteMany({ where: { ...key, aspect: { notIn: aspects } } }),
          prisma.goalLikeAspects.createMany({ data: aspects.map(aspect => ({ ...key, aspect })), skipDuplicates: true }),
        ]);
      }
    } else {
      // The aspects cascade with the like
      await prisma.goalLikes.deleteMany({ where: key });
    }

    const [likeCount, storedAspects] = await Promise.all([
      prisma.goalLikes.count({ where: { goal_id: goalId } }),
      prisma.goalLikeAspects.findMany({ where: key, select: { aspect: true } }),
    ]);
    const knownAspects = Object.values(LikeAspect).filter(aspect => storedAspects.some(stored => stored.aspect === aspect));

    // Expire immediately so the user sees their own like on refresh
    revalidateTag('goalLike', { expire: 0 });
    return Response.json({ message: liked ? t("api:goalLike.liked") : t("api:goalLike.unliked"), liked, likeCount, aspects: knownAspects },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }
}
