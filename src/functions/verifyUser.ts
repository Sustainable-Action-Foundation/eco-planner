'use server';

import prisma from "@/prismaClient";
import getUserHash from "./getUserHash";

export default async function verifyUser(userEmail: string, userHash: string) {
  try {
    let user = await prisma.user.findUnique({
      where: {
        email: userEmail
      }
    })

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isVerified) {
      throw new Error('User already verified');
    }

    // Compare the hash in the URL with the hash of the user object
    await getUserHash(userEmail).then((hash) => {
      if (hash !== userHash) {
        throw new Error('Invalid hash');
      }
    });

    await prisma.user.update({
      where: {
        email: userEmail
      },
      data: {
        isVerified: true
      }
    });
    return;
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'User not found') {
        return Promise.reject('User not found');
      } else if (e.message === 'User already verified') {
        return Promise.reject('User already verified');
      }
    }
    return Promise.reject('Error verifying user');
  }
}