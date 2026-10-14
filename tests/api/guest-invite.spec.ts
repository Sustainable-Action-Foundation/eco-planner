import { expect, test } from "../lib/fixtures";
import { orgIdByName, requestAs, Seed } from "../lib/api";

/*
 * Canary: guest invites are disabled until further notice (see "disabled until
 * further notice" in src/app/api/guest-invite/route.ts). Every method answers 404
 * to everyone, managers included. When guests return this spec is expected to
 * fail and should be replaced with positive coverage.
 */

const token = "00000000-0000-0000-0000-000000000000";

test("all methods are a 404 for anonymous visitors, members and managers", async ({ admin, playwright, baseURL }) => {
  const orgId = await orgIdByName(admin, Seed.orgName);
  const anonymous = await requestAs(playwright, baseURL);
  const anita = await requestAs(playwright, baseURL, Seed.anita.username, Seed.anita.password);
  try {
    const actors = { anonymous, member: anita, manager: admin };
    for (const [who, request] of Object.entries(actors)) {
      const send = await request.post("/api/guest-invite", { data: { orgId, email: "someone@example.com" } });
      expect(send.status(), `${who}: POST -> ${await send.text()}`).toBe(404);
      const accept = await request.put("/api/guest-invite", { data: { token } });
      expect(accept.status(), `${who}: PUT -> ${await accept.text()}`).toBe(404);
      const revoke = await request.delete("/api/guest-invite", { data: { token } });
      expect(revoke.status(), `${who}: DELETE -> ${await revoke.text()}`).toBe(404);
    }
  }
  finally {
    await Promise.all([anonymous.dispose(), anita.dispose()]);
  }
});
