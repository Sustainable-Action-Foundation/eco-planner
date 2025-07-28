import "server-only";
import prisma from '@/prismaClient';
import crypto from 'crypto';

export default async function getUserHash(userEmail: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: {
      email: userEmail
    },
    // Select many fields to ensure that the hash changes if any of these fields change, acts as a soft timelimit on using the hash.
    // The initial use case for the hash is as verification of the user's email when signing up or changing password (we send the hash as a query parameter in the email link),
    // so it should change when the user updates their password or verifies their email.
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      userGroups: {
        select: {
          id: true,
          name: true
        }
      },
      authoredActions: { select: { id: true } },
      authoredComments: { select: { id: true } },
      authoredData: { select: { id: true } },
      authoredRoadmaps: { select: { id: true } },
      authoredMetaRoadmaps: { select: { id: true } },
      authoredGoals: { select: { id: true } },
      authoredNotes: { select: { id: true } },
      isAdmin: true,
      isVerified: true,
    }
  })
  if (!user) {
    return Promise.reject(new Error('User not found'));
  }

  // Generate a hash of the user object using SHA256
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(user));
  return hash.digest('hex');
}