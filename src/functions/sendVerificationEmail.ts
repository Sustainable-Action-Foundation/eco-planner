'use server';

import mailClient from "@/mailClient";
import getUserHash from "./getUserHash";
import { baseUrl } from "@/lib/baseUrl";

export default async function sendVerificationEmail(email: string) {
  email = email.toLowerCase();
  if (!email) {
    return Promise.reject('Email is required');
  }

  const userHash = await getUserHash(email);

  if (!userHash) {
    return Promise.reject('User not found');
  }

  await mailClient.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Välkommen till Eco Planner',
    text: `Välkommen till Eco Planner! Vänligen följ länken för att verifiera din e-post: ${baseUrl}/verify/verify?email=${email}&hash=${userHash}`,
  }).catch((e) => {
    console.log(e);
    throw new Error('Error sending verification email');
  });
}