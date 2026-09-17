// The real places the seeded orgs stand for. Every org here carries the geo
// area code of its municipality or county, like the per-ansvarig orgs on prod,
// so the geo-aware flows (copying national goals, area presets, the curated
// statistics on the landing page) have something to run on outside prod.
//
// Kept free of runtime imports so the e2e suite can read the roster too (the
// org switcher's option count is derived from it).
//
// The domains are the places' real ones: signing up with such an address on a
// seeded instance auto-joins the org, which is what a demo wants.

import type { OrgRole, RoadmapType, Sharing } from "@/lib/prisma/generated";

export type SeedPlace = {
  /** Org name */
  name: string;
  domain: string;
  /** GeoAreas code: 2 digits for a county, 4 for a municipality */
  geoCode: string;
  roadmapType: RoadmapType;
  roadmapName: string;
  sharing: Sharing;
  /** admin's membership, or none (then only reachable through the super-admin override) */
  adminRole: OrgRole | null;
  /** Whether the org's roadmap starts as a scaled copy of the national LEAP scenario */
  leapCopy: boolean;
  /** Flavor members, "First Last"; the first one manages the org. Email is first.last@domain, password "password". */
  members: string[];
};

export const seedPlaces: SeedPlace[] = [
  {
    name: "Uppsala kommun",
    domain: "uppsala.se",
    geoCode: "0380",
    roadmapType: "MUNICIPAL",
    roadmapName: "Uppsala kommuns klimatfärdplan",
    // Org-readable: the e2e suite checks that a guest searching "Uppsala" finds nothing (see guest-disabled.spec.ts)
    sharing: "ORG",
    adminRole: "MANAGER",
    leapCopy: true,
    members: ["Karin Lind", "Erik Nyström", "Amina Hassan"],
  },
  {
    name: "Enköpings kommun",
    domain: "enkoping.se",
    geoCode: "0381",
    roadmapType: "MUNICIPAL",
    roadmapName: "Enköpings klimatfärdplan",
    sharing: "PUBLIC",
    adminRole: "MEMBER",
    leapCopy: true,
    members: ["Johan Berg", "Sara Holm"],
  },
  {
    name: "Bodens kommun",
    domain: "boden.se",
    geoCode: "2582",
    roadmapType: "MUNICIPAL",
    roadmapName: "Bodens klimatfärdplan",
    sharing: "PUBLIC",
    adminRole: "MEMBER",
    leapCopy: true,
    members: ["Maja Sandberg", "Nils Forsberg"],
  },
  {
    name: "Region Norrbotten",
    domain: "norrbotten.se",
    geoCode: "25",
    roadmapType: "REGIONAL",
    roadmapName: "Norrbottens klimat- och energistrategi",
    sharing: "PUBLIC",
    adminRole: null,
    leapCopy: true,
    members: ["Ingrid Dahl", "Petter Lund", "Yusuf Ahmed"],
  },
  {
    name: "Göteborgs stad",
    domain: "goteborg.se",
    geoCode: "1480",
    roadmapType: "MUNICIPAL",
    roadmapName: "Göteborgs klimatfärdplan",
    sharing: "ORG",
    adminRole: null,
    leapCopy: true,
    members: ["Elin Ekström", "Ali Rahimi"],
  },
  {
    name: "Malmö stad",
    domain: "malmo.se",
    geoCode: "1280",
    roadmapType: "MUNICIPAL",
    roadmapName: "Malmös klimatfärdplan",
    sharing: "PUBLIC",
    adminRole: null,
    leapCopy: true,
    members: ["Oskar Åkesson", "Hanna Persson"],
  },
  {
    // No copy of the national scenario: its roadmap starts as an empty draft,
    // so the landing page's "copy the national goals" flow has a target to demo
    name: "Kiruna kommun",
    domain: "kiruna.se",
    geoCode: "2584",
    roadmapType: "MUNICIPAL",
    roadmapName: "Kirunas klimatfärdplan",
    sharing: "ORG",
    adminRole: null,
    leapCopy: false,
    members: ["Lars Niia", "Fatima Ali"],
  },
];

/** "Karin Lind" → "karin.lind", usable as username and email local part */
export function memberSlug(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}
