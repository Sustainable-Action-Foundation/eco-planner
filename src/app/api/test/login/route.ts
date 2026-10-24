import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSession, sessionOptionsFor } from "@/lib/session";
import { usernameKey } from "@/functions/username";
import type { JSONValue } from "@/types";

/**
 * Test-only: starts a session for a seeded user by username, without a mail round
 * trip. The suite logs in as the same few users hundreds of times per run, far past
 * what the per-address throttle of /api/login-link allows (and the link flow itself
 * has its own specs). Exists only under TEST_ENVIRONMENT=testing; everywhere else
 * every request is a 404.
 */
export async function POST(request: NextRequest) {
  // Without this the env check below finishes before any request data is read, so with
  // Cache Components `next build` prerenders the handler and bakes the 404 in
  await connection();
  if (process.env.TEST_ENVIRONMENT !== "testing") {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.username !== "string") {
    return Response.json({ message: "Invalid body; username is required" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { username_lower: usernameKey(body.username) },
    select: { id: true, username: true, is_super_admin: true, session_version: true },
  });
  if (!user) {
    return Response.json({ message: "No such user" }, { status: 404 });
  }

  const session = await readSession(await cookies(), sessionOptionsFor(body.remember === true));
  session.user = {
    id: user.id,
    username: user.username,
    isLoggedIn: true,
    isSuperAdmin: user.is_super_admin,
    sessionVersion: user.session_version,
  };
  await session.save();

  return Response.json({ message: "Login successful" }, { status: 200 });
}
