import type { APIRequestContext } from "playwright/test";
import { test as base } from "./fixtures";
import { anonymousRequest, Seed, userRequest } from "./api";

/*
 * The sandbox `test` plus API-only request contexts for the other seeded
 * roles, for contract specs that compare what each role may do:
 * `anita` (plain member of the fixtures org, in its group), `orgless`
 * (verified, no memberships) and `anon` (no session).
 */
export const test = base.extend<{ anita: APIRequestContext, orgless: APIRequestContext, anon: APIRequestContext }>({
  anita: async ({ playwright, baseURL }, use) => {
    const request = await userRequest(playwright, baseURL, Seed.anita.username);
    await use(request);
    await request.dispose();
  },
  orgless: async ({ playwright, baseURL }, use) => {
    const request = await userRequest(playwright, baseURL, Seed.orgless.username);
    await use(request);
    await request.dispose();
  },
  anon: async ({ playwright, baseURL }, use) => {
    const request = await anonymousRequest(playwright, baseURL);
    await use(request);
    await request.dispose();
  },
});

export { expect } from "playwright/test";
