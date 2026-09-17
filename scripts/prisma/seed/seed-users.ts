// Seeds the users and orgs. The three users and their credentials are relied
// upon by the e2e test suite:
//   admin/admin  -> super admin + org manager, verified
//   anita/anita  -> regular org member, verified
//   anton/anton  -> regular org member, NOT verified (cannot log in)
//   greta/greta  -> GUEST in the org AND in the granted group: guests are disabled,
//                   so she must see/edit NOTHING beyond public content (canary for
//                   the guest-disabled invariants, see tests/e2e/guest-disabled.spec.ts)
//   orgless/orgless -> verified but with NO org memberships: sees only public
//                   content, cannot create anything (disabled create button)
//
// Besides Sustainable Action (the org owning the test fixtures and the national
// scenario) every org is a real place with its geo area code (see places.ts),
// with a few members of its own (first.last@<domain>, password "password").
// admin manages one of them and is a plain member of two more, so the start
// page switcher holds more orgs than its chip limit and renders as a select;
// the rest are only reachable through the super-admin override.

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { OrgRole } from "@/lib/prisma/generated";
import type { SeededUsers } from "./helpers.ts";
import { memberSlug, seedPlaces } from "./places.ts";

export async function seedUsers(): Promise<SeededUsers> {
  const [adminPassword, anitaPassword, antonPassword, gretaPassword, orglessPassword, memberPassword] = await Promise.all([
    bcrypt.hash("admin", 10),
    bcrypt.hash("anita", 10),
    bcrypt.hash("anton", 10),
    bcrypt.hash("greta", 10),
    bcrypt.hash("orgless", 10),
    bcrypt.hash("password", 10),
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

  // The org that owns the test fixtures and the national scenario; its domain matches the users' emails so signup auto-joins.
  const org = await prisma.orgs.create({
    data: {
      name: "Sustainable Action",
      // Canonical SAF domain; sustainable-action.ngo signups alias into it (see orgDomainAliases)
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

  // The places: one org each, geo-tagged, with its own members
  const places: SeededUsers["places"] = [];
  for (const place of seedPlaces) {
    const members = [];
    for (const name of place.members) {
      const slug = memberSlug(name);
      members.push(await prisma.users.create({
        data: {
          username: slug,
          password_hash: memberPassword,
          is_super_admin: false,
          is_verified: true,
          email: `${slug}@${place.domain}`,
        },
      }));
    }

    const placeOrg = await prisma.orgs.create({
      data: {
        name: place.name,
        domain: place.domain,
        geo_area: { connect: { code: place.geoCode } },
        memberships: {
          createMany: {
            data: [
              ...(place.adminRole ? [{ user_id: admin.id, role: place.adminRole }] : []),
              // The first member manages the place
              ...members.map((member, index) => ({ user_id: member.id, role: index === 0 ? OrgRole.MANAGER : OrgRole.MEMBER })),
            ],
          },
        },
      },
    });
    places.push({ place, org: placeOrg, members });
  }

  return { admin, anita, anton, all: [admin, anita, anton], org, group, places };
}
