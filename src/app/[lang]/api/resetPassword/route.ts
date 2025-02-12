import bcrypt from "bcrypt";
import getUserHash from "@/functions/getUserHash";
import prisma from "@/prismaClient";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  const { email, hash, newPassword }: { email: string; hash: string; newPassword: string; } = await request.json();
  if (!email || !hash || !newPassword || typeof email !== 'string' || typeof hash !== 'string' || typeof newPassword !== 'string') {
    return Response.json({ message: 'Email, hash, and new password are required' }, { status: 400 });
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  // Compare the provided hash with the hash of the user object
  // Fails with the same message if the user does not exist
  const userHash = await getUserHash(email).catch(() => null);
  if (!userHash || userHash !== hash) {
    return Response.json({ message: 'Invalid hash' }, { status: 400 });
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