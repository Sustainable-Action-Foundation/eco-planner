import getUserHash from "@/functions/getUserHash";
import prisma from "@/prismaClient";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  const { email, hash }: { email: string; hash: string; } = await request.json();
  if (!email || !hash || typeof email !== 'string' || typeof hash !== 'string') {
    return Response.json({ message: 'Email and hash are required' }, { status: 400 });
  }

  // Compare the provided hash with the hash of the user object
  // Fails with the same message if the user does not exist
  const userHash = await getUserHash(email).catch(() => null);
  if (!userHash || userHash !== hash) {
    return Response.json({ message: 'Invalid hash' }, { status: 400 });
  }

  // Verify user
  try {
    await prisma.user.update({
      where: {
        email: email
      },
      data: {
        isVerified: true
      }
    });
  } catch {
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'User verified' }, { status: 200, headers: { 'Location': '/login' } });
}