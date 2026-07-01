// Seeds the users and a user group.
// The three users and their credentials are relied upon by the e2e test suite:
//   admin/admin  -> admin, verified
//   anita/anita  -> regular, verified
//   anton/anton  -> regular, NOT verified (cannot log in)

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SeededUsers } from "./helpers.ts";

export async function seedUsers(): Promise<SeededUsers> {
  const [adminPassword, anitaPassword, antonPassword] = await Promise.all([
    bcrypt.hash("admin", 10),
    bcrypt.hash("anita", 10),
    bcrypt.hash("anton", 10),
  ]);

  /** A user with admin rights, username and password 'admin'. */
  const admin = await prisma.user.create({
    data: { username: "admin", password: adminPassword, isAdmin: true, isVerified: true, email: "admin@sustainable-action.ngo" },
  });
  /** Anita is a regular, verified user. */
  const anita = await prisma.user.create({
    data: { username: "Anita", password: anitaPassword, isAdmin: false, isVerified: true, email: "anita@sustainable-action.ngo" },
  });
  /** Anton is a regular user who's been too lazy to verify their email. */
  const anton = await prisma.user.create({
    data: { username: "Anton", password: antonPassword, isAdmin: false, isVerified: false, email: "anton@sustainable-action.ngo" },
  });

  // A group of the two regular users, used to exercise group-based view/edit sharing on roadmaps.
  const group = await prisma.userGroup.create({
    data: { name: "Hållbarhetsgruppen", users: { connect: [{ id: anita.id }, { id: anton.id }] } },
  });

  return { admin, anita, anton, all: [admin, anita, anton], group };
}
