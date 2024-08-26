import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import mailClient from "@/mailClient";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // Get email from request body
  const { email } = await request.json().catch(() => null);
  if (!email || typeof email !== 'string') {
    return Response.json({ message: 'Email is required' }, { status: 400 });
  }

  // Get hash based on user data (used as key for verification)
  // Also indirectly checks if user exists but we don't want to expose that information (since this searches by email rather than ID, it could be used to check if an email is registered)
  const userHash = await getUserHash(email.toLowerCase()).catch(() => null);
  if (!userHash) {
    return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/password' } });
  }

  try {
    // Send verification message
    await mailClient.sendMail({
      from: `Eco Planner ${process.env.MAIL_USER}`,
      to: email.toLowerCase(),
      subject: 'Välkommen till Eco Planner',
      text: `Välkommen till Eco Planner! Vänligen följ länken och tryck på knappen för att verifiera din e-post: ${baseUrl}/verify/verify?email=${email}&hash=${userHash}`,
    });
  } catch (e) {
    console.log(e);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ message: 'If the user exists and is unverified, an email with instructions for verification will be sent' }, { status: 200, headers: { 'Location': '/password' } });
}