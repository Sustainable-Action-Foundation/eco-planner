import { NextRequest } from "next/server";
import { getSession, options } from "@/lib/session"
import prisma from "@/prismaClient";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { JSONValue } from "@/types";

export async function POST(request: NextRequest) {
  const data = await request.json() as JSONValue;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return Response.json({ message: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Validate request body
  const { username, password, remember } = data;
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return Response.json({ message: 'Username and password are required and must be strings' },
      { status: 400 }
    );
  }

  // Create session, set maxAge if user toggled remember me
  const session = await getSession(await cookies(), remember ? {
    ...options,
    cookieOptions: {
      ...options.cookieOptions,
      maxAge: 365 * 24 * 60 * 60, // Standard year in seconds
    }
  } : options);

  // Validate credentials
  let user: { id: string; username: string; password: string; isAdmin: boolean; userGroups: { name: string; }[]; };

  try {
    user = await prisma.user.findUniqueOrThrow({
      where: {
        username: username,
        isVerified: true,
      },
      select: {
        id: true,
        username: true,
        password: true,
        isAdmin: true,
        userGroups: {
          select: {
            name: true,
          }
        },
      }
    });
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'User not found or has not verified their email' },
      { status: 400 }
    );
  }

  // Check password
  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return Response.json({ message: 'Incorrect password' },
      { status: 400 }
    );
  }

  // Set session
  session.user = {
    id: user.id,
    username: user.username,
    isLoggedIn: true,
    isAdmin: user.isAdmin,
    userGroups: user.userGroups.map(group => group.name),
  };

  await session.save();

  // if (remember) {
  //   console.log(typeof session.updateConfig);
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
    { status: 200 }
  );
}