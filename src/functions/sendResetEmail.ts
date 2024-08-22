'use server';

import mailClient from "@/mailClient";
import getUserHash from "./getUserHash";
import { baseUrl } from "@/lib/baseUrl";

export default async function sendResetEmail(email: string) {
  email = email.toLowerCase();
  if (!email) {
    return Promise.reject('Email is required');
  }

  const userHash = await getUserHash(email);

  if (!userHash) {
    return Promise.reject('User not found');
  }

  mailClient.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: 'Återställ lösenord för Eco Planner',
    text: `Hej! För att återställa ditt lösenord kan du klicka på den här länken: ${baseUrl}/password/reset?email=${email}&hash=${userHash}`,
  }).catch((e) => {
    console.log(e);
    return Promise.reject('Error sending password reset email');
  });
}