import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import mailClient, { type MailOptions } from "@/mailClient";
import { prisma } from "@/lib/prisma";
import type { JSONValue } from "@/types";
import type { NextRequest } from "next/server";

/** Sends a verification email to the given address. */
export async function POST(request: NextRequest) {
  const t = await serveTea("email");
  // Get email from request body
  const body = await (request.json().catch(() => null) as Promise<JSONValue>);
  if (typeof body !== "object" || body == null || Array.isArray(body) || typeof body.email !== 'string') {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  // Get hash based on user data (used as key for verification)
  // Also indirectly checks if user exists but we don't want to expose that information (since this searches by email rather than ID, it could be used to check if an email is registered)
  const userHash = await getUserHash(body.email.toLowerCase()).catch(() => null);
  if (!userHash) {
    return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/verify' } });
  }

  const mailContent: MailOptions = {
    from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
    to: body.email.toLowerCase(),
    subject: t("email:verification.subject"),
    text: t("email:verification.body", { baseUrl: baseUrl, email: body.email, userHash: userHash }),
  };

  try {
    // Send verification message
    await mailClient.sendMail(mailContent);
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/verify' } });
}

/** Marks the user as verified, keyed by the hash from the verification email. */
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
    await prisma.users.update({
      where: {
        email: email,
      },
      data: {
        is_verified: true,
      },
    });
  } catch {
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'User verified' }, { status: 200, headers: { 'Location': '/login' } });
}