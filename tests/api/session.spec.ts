import { expect, test } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { mailToken, SESSION_COOKIE, startPageTitle } from "../lib/api";
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

test.describe("session revocation elsewhere", () => {
  test("a password reset logs the user out everywhere", async ({ playwright, baseURL }, testInfo) => {
    const { email, request: laptop } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "reset");
    const resetter = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      expect(await authedStatus(laptop)).not.toBe(401);
      const hash = await mailToken(resetter, email);
      const response = await resetter.patch("/api/password", { data: { email, hash, newPassword: "a-brand-new-password" } });
      expect(response.status(), await response.text()).toBe(200);
      expect(await authedStatus(laptop), "the old session is gone").toBe(401);

      // The new password logs in and is honoured
      const login = await resetter.post("/api/login", { data: { username: email.split("@")[0], password: "a-brand-new-password" } });
      expect(login.status(), await login.text()).toBe(200);
      expect(await authedStatus(resetter)).not.toBe(401);
    }
    finally {
      await Promise.all([laptop.dispose(), resetter.dispose()]);
    }
  });

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
});
