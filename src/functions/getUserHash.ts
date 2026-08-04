import "server-only";
import { prisma } from '@/lib/prisma';
import crypto from 'node:crypto';

export default async function getUserHash(userEmail: string): Promise<string> {
  const user = await prisma.users.findUnique({
    where: {
      email: userEmail,
    },
    // Select many fields to ensure that the hash changes if any of these fields change, acts as a soft timelimit on using the hash.
    // The initial use case for the hash is as verification of the user's email when signing up or changing password (we send the hash as a query parameter in the email link),
    // so it should change when the user updates their password or verifies their email.
    select: {
      id: true,
      email: true,
      username: true,
      password_hash: true,
      memberships: {
        select: {
          org_id: true,
          role: true,
        },
      },
      authored_actions: { select: { id: true } },
      authored_comments: { select: { id: true } },
      authored_data_series: { select: { id: true } },
      authored_goals: { select: { id: true } },
      authored_roadmap_iterations: { select: { id: true } },
      authored_roadmaps: { select: { id: true } },
      is_super_admin: true,
      is_verified: true,
    },
  });
  if (!user) {
    return Promise.reject(new Error('User not found'));
  }

  // Generate a hash of the user object using SHA256
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(user));
  return hash.digest('hex');
}