import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session"
import { allowedDomains } from "@/lib/allowedDomains";
import prisma from "@/prismaClient"
import bcrypt from "bcrypt";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const session = await getSession(cookies());

  let { username, email, password }: { username: string; email: string; password: string; } = await request.json();

  // Validate request body
  if (!username || !email || !password) {
    return Response.json({ message: 'Username, email, and password are required' },
      { status: 400 }
    );
  }
  email = email.toLowerCase();

  // Check if email or username already exists; this is implicitly done by Prisma when creating a new user,
  // but we want to return a more specific error message
  const usernameExists = await prisma.user.findUnique({
    where: {
      username: username,
    }
  });

  if (usernameExists) {
    return Response.json({ message: 'Username "' + username + '" is already taken' },
      { status: 400 }
    );
  }

  const emailExists = await prisma.user.findUnique({
    where: {
      email: email,
    }
  });

  if (emailExists) {
    return Response.json({ message: 'Email "' + email + '" is already in use' },
      { status: 400 }
    );
  }

  // Check if email belongs to an allowed domain
  // TODO: Add actual email validation by sending a verification email
  if (!allowedDomains.includes(email.split('@')[1])) {
    return Response.json({ message: 'Email domain "' + email.split('@')[1] + '" is not allowed' },
      { status: 400 }
    );
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Create user
  try {
    await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: hashedPassword,
        userGroups: {
          connectOrCreate: {
            where: {
              name: email.split('@')[1],
            },
            create: {
              name: email.split('@')[1],
            },
          },
        },
      },
    });
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'Error creating user' },
      { status: 500 }
    );
  }

  // Set user session
  let user: { id: string; username: string; isAdmin: boolean; userGroups: { name: string; }[]; };
  try {
    user = await prisma.user.findUniqueOrThrow({
      where: {
        username: username,
      },
      select: {
        id: true,
        username: true,
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
    return new NextResponse(
      JSON.stringify({ message: 'Error while retrieving user to set user session' }),
      { status: 500 }
    );
  }

  session.user = {
    id: user.id,
    username: user.username,
    isLoggedIn: true,
    isAdmin: user.isAdmin,
    userGroups: user.userGroups.map(group => group.name),
  };

  await session.save();

  return Response.json({ message: 'User created' },
    { status: 200 }
  )
}