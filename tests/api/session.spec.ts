import { expect, test } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { requestAs, Seed, SESSION_COOKIE, startPageTitle } from "../lib/api";
import { freshContext, linkLogin, linkPlace, newLinkUser } from "../lib/login-link";

/*
 * Session revocation. The cookie is stateless (iron-session), so "log out everywhere"
 * bumps Users.session_version; getSession() then reads every older cookie as anonymous.
 * Seeded users are shared with the whole run (and the setup project's storage states),
 * so every test here creates its own user through the login-link flow.
 */

async function sessionCookie(request: APIRequestContext) {
  return (await request.storageState()).cookies.find(cookie => cookie.name === SESSION_COOKIE);
}

/** 401 when the context's session is not honoured, something else when it is */
async function authedStatus(request: APIRequestContext): Promise<number> {
  const response = await request.post("/api/goal-like", { data: { goalId: "00000000-0000-0000-0000-000000000000" } });
  return response.status();
}

test.describe("POST /api/logout { everywhere: true }", () => {
  test("logs out the other devices of the user, and only them", async ({ playwright, baseURL }, testInfo) => {
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "everywhere");
    const phone = await freshContext(playwright, baseURL, testInfo.workerIndex);
    const bystander = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "bystander");
    try {
      await linkLogin(phone, email);
      expect(await authedStatus(laptop), "laptop logged in").not.toBe(401);
      expect(await authedStatus(phone), "phone logged in").not.toBe(401);

      const response = await laptop.post("/api/logout", { data: { everywhere: true } });
      expect(response.status(), await response.text()).toBe(200);
      expect(await sessionCookie(laptop), "the laptop's own cookie is cleared").toBeUndefined();

      // The phone still holds its cookie, but the server no longer honours it
      expect(await sessionCookie(phone), "the phone's cookie is untouched").toBeTruthy();
      expect(await authedStatus(phone), "the phone is logged out").toBe(401);
      expect(await authedStatus(bystander.request), "other users are unaffected").not.toBe(401);

      // A fresh login works and is honoured: it carries the new version
      await linkLogin(phone, email);
      expect(await authedStatus(phone), "logged in again").not.toBe(401);
    }
    finally {
      await Promise.all([laptop.dispose(), phone.dispose(), bystander.request.dispose()]);
    }
  });

  test("a plain logout leaves other devices logged in", async ({ playwright, baseURL }, testInfo) => {
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "plain");
    const phone = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      await linkLogin(phone, email);
      const response = await laptop.post("/api/logout");
      expect(response.status(), await response.text()).toBe(200);
      expect(await authedStatus(laptop)).toBe(401);
      expect(await authedStatus(phone), "the phone stays logged in").not.toBe(401);
    }
    finally {
      await Promise.all([laptop.dispose(), phone.dispose()]);
    }
  });

  test("logged out already: still a 200", async ({ request }) => {
    const response = await request.post("/api/logout", { data: { everywhere: true } });
    expect(response.status(), await response.text()).toBe(200);
  });
});

test.describe("POST /api/logout { everywhere: true, userId }: an admin revokes another user", () => {
  /** The user id behind a profile page: the `userId` prop of its "log out everywhere" button in the RSC payload (quotes are escaped there) */
  async function userIdOf(request: APIRequestContext, username: string): Promise<string> {
    const response = await request.get(`/user/${encodeURIComponent(username)}`);
    expect(response.status(), `profile of ${username}`).toBe(200);
    const match = (await response.text()).match(/userId\\?":\\?"([0-9a-f-]{36})/);
    expect(match, `user id of ${username} on the profile page`).toBeTruthy();
    return match?.[1] ?? "";
  }

  test("a super admin logs the user out of every device and keeps their own session", async ({ playwright, baseURL }, testInfo) => {
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "revoked");
    const admin = await requestAs(playwright, baseURL, Seed.admin.username);
    try {
      const userId = await userIdOf(admin, email.split("@")[0]);
      expect(await authedStatus(laptop)).not.toBe(401);

      const response = await admin.post("/api/logout", { data: { everywhere: true, userId } });
      expect(response.status(), await response.text()).toBe(200);
      expect(await authedStatus(laptop), "the user's device is logged out").toBe(401);
      expect(await authedStatus(admin), "the admin stays logged in").not.toBe(401);
      expect(await sessionCookie(admin), "the admin's cookie is untouched").toBeTruthy();

      // The user can log in again
      await linkLogin(laptop, email);
      expect(await authedStatus(laptop)).not.toBe(401);
    }
    finally {
      await Promise.all([laptop.dispose(), admin.dispose()]);
    }
  });

  test("anyone else is refused, and the body has to make sense", async ({ playwright, baseURL }, testInfo) => {
    const { request: member } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "member");
    const { email: victimEmail, request: victim } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "victim");
    const admin = await requestAs(playwright, baseURL, Seed.admin.username);
    const anon = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      const victimId = await userIdOf(admin, victimEmail.split("@")[0]);

      expect((await member.post("/api/logout", { data: { everywhere: true, userId: victimId } })).status(), "a plain member").toBe(403);
      expect(await authedStatus(member), "the member's own session is not touched by the refusal").not.toBe(401);
      expect((await anon.post("/api/logout", { data: { everywhere: true, userId: victimId } })).status(), "anonymous").toBe(401);
      expect((await admin.post("/api/logout", { data: { userId: victimId } })).status(), "userId without everywhere").toBe(400);
      expect((await admin.post("/api/logout", { data: { everywhere: true, userId: "00000000-0000-0000-0000-000000000000" } })).status(), "unknown user").toBe(404);
      expect(await authedStatus(victim), "the victim is still logged in").not.toBe(401);
    }
    finally {
      await Promise.all([member.dispose(), victim.dispose(), admin.dispose(), anon.dispose()]);
    }
  });
});

test.describe("session revocation elsewhere", () => {
  test("a revoked session reads as anonymous on pages too, cookie or not", async ({ playwright, baseURL }, testInfo) => {
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "pages");
    const phone = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      // Link-created users are members of the org owning boden.se, so the start page is its landing while logged in
      expect(await startPageTitle(laptop), "logged in: the org landing").toBe(linkPlace.orgName);

      // Revoke from the phone, so the laptop keeps its now-stale cookie
      await linkLogin(phone, email);
      const revoke = await phone.post("/api/logout", { data: { everywhere: true } });
      expect(revoke.status()).toBe(200);

      expect(await sessionCookie(laptop), "the stale cookie is still there").toBeTruthy();
      expect(await startPageTitle(laptop), "but the page renders for an anonymous visitor").not.toBe(linkPlace.orgName);
    }
    finally {
      await Promise.all([laptop.dispose(), phone.dispose()]);
    }
  });

  test("a stale cookie is sent to login from create pages, dropped, and can reach the login page", async ({ playwright, baseURL }, testInfo) => {
    // Two link mails only: the address allows a burst of three before it is throttled
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "stale");
    const phone = await freshContext(playwright, baseURL, testInfo.workerIndex);
    let tablet: APIRequestContext | null = null;
    try {
      // Logged in: the login page bounces to the start page
      const whileLoggedIn = await laptop.get("/login", { maxRedirects: 0 });
      expect(whileLoggedIn.status(), "logged in: /login redirects").toBe(307);

      const stale = await sessionCookie(laptop);
      expect(stale, "the laptop has a session cookie").toBeTruthy();
      // The same stale cookie in a second jar, for the login page below
      tablet = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "cookie": `${SESSION_COOKIE}=${stale?.value}` } });

      await linkLogin(phone, email);
      expect((await phone.post("/api/logout", { data: { everywhere: true } })).status()).toBe(200);

      // The proxy's unchecked read still sees a login, so create pages must verify it
      const create = await laptop.get("/goal/create", { maxRedirects: 0 });
      expect(create.status(), "stale: /goal/create redirects").toBe(307);
      expect(create.headers()["location"]).toContain("/login?from=%2Fgoal%2Fcreate");
      expect(create.headers()["set-cookie"] ?? "", "the stale cookie is cleared on the way").toContain(`${SESSION_COOKIE}=;`);
      expect(await sessionCookie(laptop), "and gone from the jar").toBeFalsy();

      // A stale cookie must not lock the visitor out of the login page
      const login = await tablet.get("/login", { maxRedirects: 0 });
      expect(login.status(), "stale: /login renders").toBe(200);
      expect(login.headers()["set-cookie"] ?? "", "and the stale cookie is dropped").toContain(`${SESSION_COOKIE}=;`);
    }
    finally {
      await Promise.all([laptop.dispose(), phone.dispose(), tablet?.dispose()]);
    }
  });
});
