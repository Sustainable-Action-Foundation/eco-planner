// Seeds the users, their org, and a group.
// The three users and their credentials are relied upon by the e2e test suite:
//   admin/admin  -> super admin + org manager, verified
//   anita/anita  -> regular org member, verified
//   anton/anton  -> regular org member, NOT verified (cannot log in)

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import type { SeededUsers } from "./helpers.ts";

export async function seedUsers(): Promise<SeededUsers> {
  const [adminPassword, anitaPassword, antonPassword] = await Promise.all([
    bcrypt.hash("admin", 10),
    bcrypt.hash("anita", 10),
    bcrypt.hash("anton", 10),
  ]);

  /** A super admin, username and password 'admin'. */
  const admin = await prisma.users.create({
    data: { username: "admin", password_hash: adminPassword, is_super_admin: true, is_verified: true, email: "admin@sustainable-action.ngo" },
  });
  /** Anita is a regular, verified user. */
  const anita = await prisma.users.create({
    data: { username: "Anita", password_hash: anitaPassword, is_super_admin: false, is_verified: true, email: "anita@sustainable-action.ngo" },
  });
  /** Anton is a regular user who's been too lazy to verify their email. */
  const anton = await prisma.users.create({
    data: { username: "Anton", password_hash: antonPassword, is_super_admin: false, is_verified: false, email: "anton@sustainable-action.ngo" },
  });

  // The org that owns all seeded content; its domain matches the users' emails so signup auto-joins.
  const org = await prisma.orgs.create({
    data: {
      name: "Sustainable Action",
      domain: "sustainable-action.org",
      memberships: {
        createMany: {
          data: [
            { user_id: admin.id, role: OrgRole.MANAGER },
            { user_id: anita.id, role: OrgRole.MEMBER },
            { user_id: anton.id, role: OrgRole.MEMBER },
          ],
        },
      },
    },
    include: { memberships: true },
  });

  // A group of the two regular users, used to exercise grant-based sharing.
  const anitaMembership = org.memberships.find(membership => membership.user_id === anita.id);
  const antonMembership = org.memberships.find(membership => membership.user_id === anton.id);
  if (!anitaMembership || !antonMembership) {
    throw new Error("Seeded org memberships not found");
  }
  const group = await prisma.groups.create({
    data: {
      name: "Hållbarhetsgruppen",
      org: { connect: { id: org.id } },
      memberships: {
        // The composite FK to the group supplies org_id; only the membership id is needed
        createMany: {
          data: [
            { membership_id: anitaMembership.id },
            { membership_id: antonMembership.id },
          ],
        },
      },
    },
  });

  return { admin, anita, anton, all: [admin, anita, anton], org, group };
}
