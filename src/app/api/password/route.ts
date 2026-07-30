import bcrypt from "bcryptjs";
import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import mailClient from "@/mailClient";
import { prisma } from "@/lib/prisma";
import type { JSONValue } from "@/types";
import type { NextRequest } from "next/server";

/** Sends a password reset email to the given address. */
export async function POST(request: NextRequest) {
  const t = await serveTea("email");

  // Get email from request body
  const body = await (request.json().catch(() => null) as Promise<JSONValue>);
  if (typeof body !== "object" || body == null || Array.isArray(body) || typeof body.email !== 'string') {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  // Get hash based on user data (used as key for verification)
  // Also indirectly checks if user exists, but we don't want to expose that information (since this searches by email rather than ID, it could be used to check if an email is registered)
  const userHash = await getUserHash(body.email.toLowerCase()).catch(() => null);
  if (!userHash) {
    return Response.json({ message: 'If the user exists, an email will be sent to reset the password' }, { status: 200, headers: { 'Location': '/password' } });
  }

  const mailContent = {
    from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
    to: body.email,
    subject: t("email:reset.subject"),
    text: t("email:reset.body", { baseUrl: baseUrl, email: body.email, userHash: userHash }),
  };

  try {
    // Send password reset message
    await mailClient.sendMail(mailContent);
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'If the user exists, an email will be sent to reset the password' }, { status: 200, headers: { 'Location': '/password' } });
}

/** Sets a new password, keyed by the hash from the reset email. */
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
    await prisma.users.update({
      where: {
        email: email,
      },
      data: {
        password_hash: hashedPassword,
        is_verified: true,
      },
    });
  } catch {
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'Password updated' }, { status: 200, headers: { 'Location': '/login' } });
}
