'use server';

import prisma from "@/prismaClient";
import bcrypt from "bcrypt";
import getUserHash from "./getUserHash";

export default async function resetPassword(email: string, newPassword: string, userHash: string) {
  email = email.toLowerCase();
  if (!email) {
    return Promise.reject('Email is required');
  }

  if (!newPassword) {
    return Promise.reject('Password is required');
  }

  if (!userHash) {
    return Promise.reject('Hash is required');
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

  let user = await prisma.user.findUnique({
    where: {
      email: email
    }
  }).catch((e) => { throw new Error('Error finding user') });

  if (!user) {
    return Promise.reject('User not found');
  }

  // Compare the hash in the URL with the hash of the user object
  await getUserHash(email).then((hash) => {
    if (hash !== userHash) {
      throw new Error('Invalid hash');
    }
  });

  await prisma.user.update({
    where: {
      email: email
    },
    data: {
      password: hashedPassword,
      isVerified: true,
    }
  }).catch((e) => { throw new Error('Error updating user') });

  return;
}