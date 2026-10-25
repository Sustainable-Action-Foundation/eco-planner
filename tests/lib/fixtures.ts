import { expect, test as base } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { createIteration, createRoadmap, deleteRoadmap, loginAs, orgIdByName, Seed, uniqueLabel } from "./api";

/*
 * Per-test sandbox: a throwaway roadmap with one published iteration in the
 * fixtures org ("Sustainable Action"), created through the API as the super
 * admin and deleted afterwards (the delete cascades). Specs that mutate data
 * should build on this instead of the seeded roadmaps, so runs, retries and
 * browser projects never see each other's leftovers.
 *
 * `admin` is an API context logged in as admin regardless of the test's own
 * storage state, so a spec running as anita can still set up and tear down.
 */
export type Sandbox = {
  /** Unique per project, retry and run; use it in names so lookups don't drift */
  label: string;
  orgId: string;
  roadmapId: string;
  iterationId: string;
};

export const test = base.extend<{ admin: APIRequestContext, sandbox: Sandbox }>({
  admin: async ({ playwright, baseURL }, use) => {
    // Streamed pages read back through it (pageEntity) can exceed the 15 s action timeout on a loaded shared server
    const request = await playwright.request.newContext({ baseURL, timeout: 60_000 });
    await loginAs(request, Seed.admin.username);
    await use(request);
    await request.dispose();
  },
  sandbox: async ({ admin }, use, testInfo) => {
    const label = uniqueLabel(testInfo);
    const orgId = await orgIdByName(admin, Seed.orgName);
    const roadmapId = await createRoadmap(admin, orgId, { name: `Sandbox ${label}` });
    try {
      const iterationId = await createIteration(admin, roadmapId);
      await use({ label, orgId, roadmapId, iterationId });
    }
    finally {
      await deleteRoadmap(admin, roadmapId);
    }
  },
});

export { expect };
