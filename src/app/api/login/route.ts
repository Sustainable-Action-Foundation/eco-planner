import type { NextRequest } from "next/server";
import { getSession, options } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { JSONValue } from "@/types";

export async function POST(request: NextRequest) {
  const data = await request.json() as JSONValue;
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

  // Create session, set maxAge if user toggled remember me
  const session = await getSession(await cookies(), remember ? {
    ...options,
    cookieOptions: {
      ...options.cookieOptions,
      maxAge: 365 * 24 * 60 * 60, // Standard year in seconds
    },
  } : options);

  // Validate credentials. A missing/unverified user is expected control flow,
  // not an error worth a stack trace in the server log.
  const user = await prisma.users.findUnique({
    where: {
      username: username,
      is_verified: true,
    },
    select: {
      id: true,
      username: true,
      password_hash: true,
      is_super_admin: true,
    },
  });

  if (!user) {
    return Response.json({ message: 'User not found or has not verified their email' },
      { status: 400 },
    );
  }

  // Check password
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return Response.json({ message: 'Incorrect password' },
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
  };

  await session.save();

  // if (remember) {
  //   session.updateConfig({
  //     ...options,
  //     cookieOptions: {
  //       ...options.cookieOptions,
  //       maxAge: 14 * 24 * 60 * 60, // 14 days in seconds
  //     }
  //   });
  //   session.save();
  // }

  return Response.json({ message: 'Login successful' },
    { status: 200 },
  );
}