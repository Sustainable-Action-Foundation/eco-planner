import type { APIRequestContext } from "playwright/test";
import { expect, test } from "../lib/fixtures";
import { createRoadmap, deleteRoadmap, orgIdByName, pageStatus, requestAs, Seed, uniqueLabel } from "../lib/api";

/*
 * A super admin can switch their powers off for the browser session
 * (POST /api/user/privileges { superAdmin }), and is then a regular user with
 * only their org memberships: access filters, the checker and admin-only routes
 * all follow. The seeded admin manages "Sustainable Action" and has no
 * membership in "Göteborgs stad".
 */

const otherOrg = "Göteborgs stad";

async function setSuperAdmin(request: APIRequestContext, superAdmin: boolean, expected = 200): Promise<void> {
  const response = await request.post("/api/user/privileges", { data: { superAdmin } });
  expect(response.status(), `privileges -> ${await response.text()}`).toBe(expected);
}

test.describe("super admin toggle", () => {
  test("only a super admin may toggle", async ({ playwright, baseURL }) => {
    const [anonymous, anita, admin] = await Promise.all([
      requestAs(playwright, baseURL),
      requestAs(playwright, baseURL, Seed.anita.username),
      requestAs(playwright, baseURL, Seed.admin.username),
    ]);
    try {
      await setSuperAdmin(anonymous, false, 401);
      await setSuperAdmin(anita, false, 403);
      await setSuperAdmin(admin, false, 200);
      // The switch itself survives the suspension
      await setSuperAdmin(admin, true, 200);
      const invalid = await admin.post("/api/user/privileges", { data: { superAdmin: "no" } });
      expect(invalid.status()).toBe(400);
    }
    finally {
      await Promise.all([anonymous, anita, admin].map(request => request.dispose()));
    }
  });

  test("while suspended the admin is a regular user", async ({ playwright, baseURL, admin: setup }, testInfo) => {
    test.setTimeout(120_000);
    const label = uniqueLabel(testInfo, "suspended");
    const otherOrgId = await orgIdByName(setup, otherOrg);
    const ownOrgId = await orgIdByName(setup, Seed.orgName);
    // GROUPS sharing without grants: only Göteborg's managers (and super admins) read it
    const roadmapId = await createRoadmap(setup, otherOrgId, { name: `Groups only ${label}`, access: { sharing: "GROUPS", grants: [] } });
    const admin = await requestAs(playwright, baseURL, Seed.admin.username);
    try {
      const page = `/roadmap/${roadmapId}`;
      expect(await pageStatus(admin, page), "privileged").toBe(200);

      await setSuperAdmin(admin, false);
      expect(await pageStatus(admin, page), "suspended").toBe(404);
      // Org management of an org they do not manage: unmanaged orgs answer 404
      const orgEdit = await admin.put("/api/org", { data: { orgId: otherOrgId, geoAreaCode: "1480" } });
      expect(orgEdit.status(), `org edit while suspended -> ${await orgEdit.text()}`).toBe(404);
      // National roadmaps are super-admin only, even in an org they manage
      const national = await admin.post("/api/roadmap", {
        data: { name: `National ${label}`, description: "", type: "NATIONAL", actor: null, geoAreaCode: null, orgId: ownOrgId, parentRoadmapId: null },
      });
      expect(national.status(), `national roadmap while suspended -> ${await national.text()}`).toBe(403);
      // Their own org still works as for any manager
      expect(await pageStatus(admin, `/org/${ownOrgId}/groups`), "own org management").toBe(200);

      await setSuperAdmin(admin, true);
      expect(await pageStatus(admin, page), "restored").toBe(200);
      const orgEditAgain = await admin.put("/api/org", { data: { orgId: otherOrgId, geoAreaCode: "1480" } });
      expect(orgEditAgain.status(), `org edit restored -> ${await orgEditAgain.text()}`).toBe(200);
    }
    finally {
      await admin.dispose();
      await deleteRoadmap(setup, roadmapId);
    }
  });

  test("a new login starts privileged", async ({ playwright, baseURL }) => {
    const admin = await requestAs(playwright, baseURL, Seed.admin.username);
    try {
      await setSuperAdmin(admin, false);
      const response = await admin.post("/api/test/login", { data: { username: Seed.admin.username } });
      expect(response.status()).toBe(200);
      const orgEdit = await admin.put("/api/org", { data: { orgId: await orgIdByName(admin, otherOrg), geoAreaCode: "1480" } });
      expect(orgEdit.status(), await orgEdit.text()).toBe(200);
    }
    finally {
      await admin.dispose();
    }
  });
});
