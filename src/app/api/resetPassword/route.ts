import bcrypt from "bcryptjs";
import getUserHash from "@/functions/getUserHash";
import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";
import type { JSONValue } from "@/types";

export async function PATCH(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>);
  if (!body || typeof body !== "object" || Array.isArray(body) || !(typeof body.email === 'string') || !(typeof body.hash === 'string') || !(typeof body.newPassword === 'string')) {
    return Response.json({ message: 'Invalid body; email, hash, and new password are required' }, { status: 400 });
  }
  const { email, hash, newPassword } = body;

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Compare the provided hash with the hash of the user object
  // Fails with the same message if the user does not exist
  const userHash = await getUserHash(email).catch(() => null);
  if (!userHash || userHash !== hash) {
    return Response.json({ message: 'Invalid email or hash' }, { status: 400 });
  }

  // Update password. We also set isVerified to true, since the user has verified their email address by clicking the link in the email.
  try {
    await prisma.user.update({
      where: {
        email: email
      },
      data: {
        password: hashedPassword,
        isVerified: true
      }
    });
  } catch {
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'Password updated' }, { status: 200, headers: { 'Location': '/login' } });
}