import getUserHash from "@/functions/getUserHash";
import prisma from "@/lib/prisma/prisma";
import type { JSONValue } from "@/types";
import type { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>);
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.email !== 'string' || typeof body.hash !== 'string') {
    return Response.json({ message: 'Invalid body; email and hash are required' }, { status: 400 });
  }
  const { email, hash } = body;

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