import { readSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { JSONValue } from "@/types";

/**
 * Logs out. With `{ everywhere: true }` in the body, also invalidates every other
 * session of the user by bumping `Users.session_version` (see getSession): devices
 * holding an older cookie read as anonymous on their next request.
 */
export async function POST(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  const everywhere = !!body && typeof body === "object" && !Array.isArray(body) && body.everywhere === true;

  const session = await readSession(await cookies());

  if (everywhere && session.user?.isLoggedIn) {
    // The row may be gone for a stale session of a deleted user; logging out still succeeds
    await prisma.users.update({ where: { id: session.user.id }, data: { session_version: { increment: 1 } } }).catch(() => null);
  }

  // Remove session to log out
  session.destroy();

  return Response.json({ message: everywhere ? 'Logged out everywhere' : 'Logged out' },
    { status: 200 },
  );
}
