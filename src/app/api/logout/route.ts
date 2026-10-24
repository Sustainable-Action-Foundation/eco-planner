import { forgetProxySession, getSession, readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { JSONValue } from "@/types";

/**
 * Logs out. With `{ everywhere: true }` in the body, also invalidates every other
 * session of the user by bumping `Users.session_version` (see getSession): devices
 * holding an older cookie read as anonymous on their next request.
 *
 * With `{ everywhere: true, userId }` a super admin revokes another user's sessions
 * instead (a lost laptop, a leaver) and keeps their own.
 */
export async function POST(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  const options = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const everywhere = options.everywhere === true;
  const userId = typeof options.userId === "string" ? options.userId : null;

  if (userId) {
    if (!everywhere) {
      return Response.json({ message: "userId only makes sense with everywhere: true" }, { status: 400 });
    }
    // Acting on someone else needs a session that is actually honoured, not just a cookie
    const session = await getSession(await cookies());
    if (!session.user?.isLoggedIn) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!session.user.isSuperAdmin || userId === session.user.id) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }
    const target = await prisma.users.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) {
      return Response.json({ message: "No such user" }, { status: 404 });
    }
    await prisma.users.update({ where: { id: userId }, data: { session_version: { increment: 1 } } });
    forgetProxySession(userId);
    return Response.json({ message: "Logged the user out everywhere" }, { status: 200 });
  }

  const session = await readSession(await cookies());

  if (everywhere && session.user?.isLoggedIn) {
    // The row may be gone for a stale session of a deleted user; logging out still succeeds
    await prisma.users.update({ where: { id: session.user.id }, data: { session_version: { increment: 1 } } }).catch(() => null);
    forgetProxySession(session.user.id);
  }

  // Remove session to log out
  session.destroy();

  return Response.json({ message: everywhere ? 'Logged out everywhere' : 'Logged out' },
    { status: 200 },
  );
}
