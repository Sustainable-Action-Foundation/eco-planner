import { getLocale } from "@/functions/getLocale.ts";
import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import { initI18nServer, t } from "@/lib/i18nServer";
import mailClient from "@/mailClient";
import { NextRequest } from "next/server";
import Mail from "nodemailer/lib/mailer";

export async function POST(request: NextRequest) {
  // Get email from request body
  const { email } = await request.json().catch(() => null);
  if (!email || typeof email !== 'string') {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  const locale = getLocale(
    request.cookies.get("locale")?.value,
    request.headers.get("accept-language")
  );

  await initI18nServer(locale);

  // Get hash based on user data (used as key for verification)
  // Also indirectly checks if user exists but we don't want to expose that information (since this searches by email rather than ID, it could be used to check if an email is registered)
  const userHash = await getUserHash(email.toLowerCase()).catch(() => null);
  if (!userHash) {
    return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/verify' } });
  }

  const mailContent: Mail.Options = {
    from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
    to: email.toLowerCase(),
    subject: t("email:verification.subject"),
    text: t("email:verification.body", { baseUrl: baseUrl, email: email, userHash: userHash }),
  };

  try {
    // Send verification message
    await mailClient.sendMail(mailContent);
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/verify' } });
}