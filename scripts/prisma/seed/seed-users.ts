// Seeds the users, their org, and a group, plus a few extra orgs so multi-org
// behavior (the start page org switcher, the roadmap form's org select) gets
// exercised. The three users and their credentials are relied upon by the e2e
// test suite:
//   admin/admin  -> super admin + org manager, verified
//   anita/anita  -> regular org member, verified
//   anton/anton  -> regular org member, NOT verified (cannot log in)
//   greta/greta  -> GUEST in the org AND in the granted group: guests are disabled,
//                   so she must see/edit NOTHING beyond public content (canary for
//                   the guest-disabled invariants, see tests/e2e/guest-disabled.spec.ts)
//   orgless/orgless -> verified but with NO org memberships: sees only public
//                   content, cannot create anything (disabled create button)

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import type { SeededUsers } from "./helpers.ts";
import { RandomTextSE } from "../randomText";
import { randomInt } from "./helpers.ts";

export async function seedUsers(): Promise<SeededUsers> {
  const [adminPassword, anitaPassword, antonPassword, gretaPassword, orglessPassword] = await Promise.all([
    bcrypt.hash("admin", 10),
    bcrypt.hash("anita", 10),
    bcrypt.hash("anton", 10),
    bcrypt.hash("greta", 10),
    bcrypt.hash("orgless", 10),
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
  /** Greta is a GUEST: while guests are disabled her memberships must grant nothing. */
  const greta = await prisma.users.create({
    data: { username: "Greta", password_hash: gretaPassword, is_super_admin: false, is_verified: true, email: "greta@example.com" },
  });
  /** Poor little Orgless has no org memberships at all: sees only public content and cannot create anything. */
  await prisma.users.create({
    data: { username: "orgless", password_hash: orglessPassword, is_super_admin: false, is_verified: true, email: "orgless@unclaimed.example.com" },
  });

  // The org that owns all seeded content; its domain matches the users' emails so signup auto-joins.
  const org = await prisma.orgs.create({
    data: {
      name: "Sustainable Action",
      // Canonical SAF domain; sustainable-action.org signups alias into it (see orgDomainAliases)
      domain: "sustainable-action.ngo",
      memberships: {
        createMany: {
          data: [
            { user_id: admin.id, role: OrgRole.MANAGER },
            { user_id: anita.id, role: OrgRole.MEMBER },
            { user_id: anton.id, role: OrgRole.MEMBER },
            { user_id: greta.id, role: OrgRole.GUEST },
          ],
        },
      },
    },
    include: { memberships: true },
  });

  // A group of the two regular users, used to exercise grant-based sharing.
  // Greta (guest) is deliberately included: with guests disabled the group's
  // grants must still give her nothing.
  const anitaMembership = org.memberships.find(membership => membership.user_id === anita.id);
  const antonMembership = org.memberships.find(membership => membership.user_id === anton.id);
  const gretaMembership = org.memberships.find(membership => membership.user_id === greta.id);
  if (!anitaMembership || !antonMembership || !gretaMembership) {
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
            { membership_id: gretaMembership.id },
          ],
        },
      },
    },
  });

  // Extra orgs with random names and @example.com-style domains, each with a
  // few flavor users of their own (email at the org's domain, password
  // "password" — nothing logs in as them). Admin is enrolled in the first two
  // (one managed, one as plain member) so the start page switcher shows several
  // tabs; the last one has no admin membership at all and is only reachable
  // through the super-admin override, so its first flavor user manages it.
  const flavorPassword = await bcrypt.hash("password", 10);
  const adminRoles: (OrgRole | null)[] = [OrgRole.MANAGER, OrgRole.MEMBER, null];
  const usedNames = new Set([org.name]);
  const usedDomains = new Set([org.domain]);
  const usedUsernames = new Set([admin.username, anita.username, anton.username, greta.username]);
  const usedEmailSlugs = new Set([admin.username, anita.username, anton.username, greta.username].map(slugify));
  const extraOrgs: SeededUsers["extraOrgs"] = [];
  for (const adminRole of adminRoles) {
    let name: string;
    let domain: string;
    do {
      const words = RandomTextSE.words(randomInt(1, 2));
      name = words.charAt(0).toUpperCase() + words.slice(1);
      domain = `${slugify(name)}.example.com`;
    } while (usedNames.has(name) || usedDomains.has(domain));
    usedNames.add(name);
    usedDomains.add(domain);

    const members = [];
    for (let i = 0; i < randomInt(2, 4); i++) {
      let username: string;
      let emailSlug: string;
      do {
        const word = RandomTextSE.words(1);
        username = word.charAt(0).toUpperCase() + word.slice(1);
        emailSlug = slugify(username);
        // Emails are built from the slug, so dedupe on it too: distinct usernames
        // (e.g. "Grön"/"Gron") can slugify identically and collide on Users_email_key
      } while (usedUsernames.has(username) || usedEmailSlugs.has(emailSlug) || emailSlug.length < 3);
      usedUsernames.add(username);
      usedEmailSlugs.add(emailSlug);

      members.push(await prisma.users.create({
        data: {
          username,
          password_hash: flavorPassword,
          is_super_admin: false,
          is_verified: true,
          email: `${emailSlug}@${domain}`,
        },
      }));
    }

    const extraOrg = await prisma.orgs.create({
      data: {
        name,
        domain,
        memberships: {
          createMany: {
            data: [
              ...(adminRole ? [{ user_id: admin.id, role: adminRole }] : []),
              // Someone has to manage the org admin isn't part of
              ...members.map((member, index) => ({
                user_id: member.id,
                role: !adminRole && index === 0 ? OrgRole.MANAGER : OrgRole.MEMBER,
              })),
            ],
          },
        },
      },
    });
    extraOrgs.push({ org: extraOrg, members });
  }

  return { admin, anita, anton, all: [admin, anita, anton], org, group, extraOrgs };
}

/** Lowercases and strips a name down to a domain/email-safe slug. */
function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
