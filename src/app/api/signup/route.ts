import { NextRequest } from "next/server";
import { allowedDomains } from "@/lib/allowedDomains";
import prisma from "@/prismaClient"
import bcrypt from "bcrypt";
import mailClient from "@/mailClient";
import sendVerificationEmail from "@/functions/sendVerificationEmail";

export async function POST(request: NextRequest) {
  const { username, email, password }: { username: string; email: string; password: string; } = await request.json();

  // Validate request body
  if (!username || !email || !password) {
    return Response.json({ message: 'Username, email, and password are required' },
      { status: 400 }
    );
  }
  const lowercaseEmail = email.toLowerCase();

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
      email: lowercaseEmail,
    }
  });

  if (emailExists) {
    return Response.json({ message: 'Email "' + lowercaseEmail + '" is already in use' },
      { status: 400 }
    );
  }

  // Check if email belongs to an allowed domain
  if (!allowedDomains.includes(lowercaseEmail.split('@')[1])) {
    return Response.json({ message: 'Email domain "' + lowercaseEmail.split('@')[1] + '" is not allowed' },
      { status: 400 }
    );
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // If mailClient does not verify, don't try to create the user since something on the server is misconfigured. If only the sendVerificationEmail function fails, the user can try requesting a new verification email later.
  try {
    await mailClient.verify().catch(e => { console.log(e); throw e; });
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'Problem connecting to email service; User not created since server is misconfigured. Please try again later' },
      { status: 500 }
    );
  }

  // Create user
  try {
    await prisma.user.create({
      data: {
        username: username,
        email: lowercaseEmail,
        password: hashedPassword,
        userGroups: {
          connectOrCreate: {
            where: {
              name: lowercaseEmail.split('@')[1],
            },
            create: {
              name: lowercaseEmail.split('@')[1],
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

  // Send verification email. This is done after creating the user to avoid sending an email if the user creation fails.
  // If the sendMail function fails, the user is still created and can try to verify their email later.
  await sendVerificationEmail(lowercaseEmail).catch(e => { console.log(e); console.log('Error sending verification email to ' + lowercaseEmail) });

  return Response.json({ message: 'User created' },
    { status: 200 }
  )
}