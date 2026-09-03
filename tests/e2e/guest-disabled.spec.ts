import { expect, test } from "playwright/test";
import path from "node:path";
import { cwd } from "node:process";

const adminFile = path.join(cwd(), "tests/.auth/admin.json");
const guestFile = path.join(cwd(), "tests/.auth/guest.json");

// Guests are DISABLED until further notice (see "disabled until further notice"
// in the source): GUEST memberships must grant nothing and the invite flow is
// dead. Greta is the seeded canary: a GUEST in Sustainable Action AND a member
// of Hållbarhetsgruppen, which holds an RW grant on the national roadmap and an
// RO grant on the org-readable Uppsala roadmap. If guests ever leak access,
// these tests catch it. When guests are re-enabled, this suite is expected to
// fail and should be replaced with positive coverage.

test.describe("Guests are disabled", () => {
  test.use({ storageState: guestFile });

  test("A guest gets the public start page without org tabs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toBeVisible();
    // No org switcher, and the public image hero rather than an org landing
    await expect(page.locator('nav[aria-label*="org_nav_label"]')).toHaveCount(0);
    await expect(page.locator("main img").first()).toBeVisible();
  });

  test("Org-readable content stays hidden despite the group's RO grant", async ({ page }) => {
    // Uppsala län is shared with the org (not public); Greta's group holds an RO grant on it
    await page.goto(`/?searchFilter=${encodeURIComponent("Uppsala")}`);
    await expect(page.getByTestId("home-title")).toBeVisible();
    await expect(page.getByRole("link", { name: /Uppsala/ })).toHaveCount(0);
  });

  test("The group's RW grant confers no edit access on public content", async ({ page }) => {
    await page.goto(`/?searchFilter=${encodeURIComponent("Rikets färdplan")}`);
    // Public content is still readable, like for any anonymous visitor
    await page.getByRole("link", { name: "Rikets färdplan" }).first().click();
    await expect(page).toHaveURL(/\/roadmap\/[a-zA-Z0-9-]+\/v\d+$/);
    // ...but the RW grant through the group must not surface any admin controls
    await expect(page.getByTestId("admin-panel-edit")).toHaveCount(0);
  });

  test("Invite links dead-end in a 404", async ({ page }) => {
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("404.title")).toBeVisible();
  });
});

test.describe("Guest invite endpoints are dead", () => {
  test.use({ storageState: adminFile });

  test("Even org managers cannot send, accept, or revoke invites", async ({ request }) => {
    const send = await request.post("/api/guest-invite", { data: { orgId: "x", email: "a@b.se" } });
    expect(send.status()).toBe(404);
    const accept = await request.put("/api/guest-invite", { data: { token: "00000000-0000-0000-0000-000000000000" } });
    expect(accept.status()).toBe(404);
    const revoke = await request.delete("/api/guest-invite", { data: { token: "00000000-0000-0000-0000-000000000000" } });
    expect(revoke.status()).toBe(404);
  });

  test("Signup enforces the domain allowlist with no invite bypass", async ({ request }) => {
    const signup = await request.post("/api/signup", {
      data: { username: "NotInvited", email: "not.invited@invite-test.example", password: "password1234" },
    });
    expect(signup.status()).toBe(400);
  });
});
