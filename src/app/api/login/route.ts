import type { NextRequest } from "next/server";
import { readSession, sessionOptionsFor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { JSONValue } from "@/types";
import { usernameKey } from "@/functions/username";

/** Compared against when the user doesn't exist, so that path costs about as much as a real check (same 11 rounds as signup) */
const DUMMY_HASH = "$2b$11$iKytgNxZ21SdVTS29GV0muWl/Mp1pbscD0Zd6CZF6OSETNin36Z8e";

export async function POST(request: NextRequest) {
  // A body that isn't JSON is a client error, not a crash
  const data = await (request.json() as Promise<JSONValue>).catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 },
    );
  }

  // Validate request body
  const { username, password, remember } = data;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return Response.json({ message: 'Username and password are required and must be strings' },
      { status: 400 },
    );
  }

  // Create session, persistent if the user toggled remember me
  const session = await readSession(await cookies(), sessionOptionsFor(remember === true));

  // Validate credentials. A missing/unverified user is expected control flow,
  // not an error worth a stack trace in the server log.
  // The lookup goes through the case-folded key so it works regardless of DB collation.
  const user = await prisma.users.findUnique({
    where: {
      username_lower: usernameKey(username),
      is_verified: true,
    },
    select: {
      id: true,
      username: true,
      password_hash: true,
      is_super_admin: true,
      session_version: true,
    },
  });

  // Unknown, unverified, link-only (no password) and wrong-password logins get the same answer, and
  // the dummy compare keeps the timing close, so the endpoint doesn't reveal which accounts exist.
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    return Response.json({ message: 'Incorrect username or password' },
      { status: 400 },
    );
  }

  // Set session. Org and group memberships are deliberately NOT stored in the cookie;
  // they are fetched per request (see getUserAccessContext) so membership changes apply without re-login.
  session.user = {
    id: user.id,
    username: user.username,
    isLoggedIn: true,
    isSuperAdmin: user.is_super_admin,
    sessionVersion: user.session_version,
  };

  await session.save();

  return Response.json({ message: 'Login successful' },
    { status: 200 },
  );
}
