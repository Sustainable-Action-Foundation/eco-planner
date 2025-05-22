import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import mailClient from "@/mailClient";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const t = await serveTea();

  // Get email from request body
  const { email } = await request.json().catch(() => null);
  if (!email || typeof email !== 'string') {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  // Get hash based on user data (used as key for verification)
  // Also indirectly checks if user exists, but we don't want to expose that information (since this searches by email rather than ID, it could be used to check if an email is registered)
  const userHash = await getUserHash(email.toLowerCase()).catch(() => null);
  if (!userHash) {
    return Response.json({ message: 'If the user exists, an email will be sent to reset the password' }, { status: 200, headers: { 'Location': '/password' } });
  }

  const mailContent = {
    from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
    to: email,
    subject: t("email:reset.subject"),
    text: t("email:reset.body", { baseUrl: baseUrl, email: email, userHash: userHash }),
  };

  try {
    // Send password reset message
    await mailClient.sendMail(mailContent);
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'If the user exists, an email will be sent to reset the password' }, { status: 200, headers: { 'Location': '/password' } });
}