import { expect, test } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { requestAs, Seed, SESSION_COOKIE } from "../lib/api";

/*
 * Session routes around the login link: /api/logout and the test-only /api/test/login
 * the suite signs in with (TEST_ENVIRONMENT=testing). Logging in for real is
 * /api/login-link, covered by login-link.spec.ts; revocation by session.spec.ts.
 */

/** The session cookie of a request context, if any */
async function sessionCookie(request: APIRequestContext) {
  const state = await request.storageState();
  return state.cookies.find(cookie => cookie.name === SESSION_COOKIE);
}

/** Days until a cookie's `expires` (seconds since epoch); -1 (a browser-session cookie) gives a negative number */
function daysLeft(expires: number | undefined): number {
  return ((expires ?? -1) - Date.now() / 1000) / (24 * 60 * 60);
}

test.describe("/api/test/login", () => {
  test("starts the same 30-day session a redeemed link would, matched case-insensitively", async ({ playwright, baseURL }) => {
    // Seeded as "Anita"; the lookup goes through Users.username_lower
    for (const username of ["anita", "ANITA", " Anita "]) {
      const request = await requestAs(playwright, baseURL);
      try {
        const response = await request.post("/api/test/login", { data: { username } });
        expect(response.status(), `${JSON.stringify(username)}: ${await response.text()}`).toBe(200);
        expect(response.headers()["set-cookie"], "set-cookie header").toContain(`${SESSION_COOKIE}=`);
        const cookie = await sessionCookie(request);
        expect(daysLeft(cookie?.expires), JSON.stringify(username)).toBeGreaterThan(29);
        expect(daysLeft(cookie?.expires)).toBeLessThanOrEqual(31);
      }
      finally {
        await request.dispose();
      }
    }
  });

  test("an unknown username or a bad body gets no session", async ({ request }) => {
    for (const [data, status] of [[{ username: "no-such-user-ever" }, 404], [{}, 400], [{ username: 1 }, 400], [[], 400], [null, 400]] as const) {
      const response = await request.post("/api/test/login", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(status);
    }
    expect(await sessionCookie(request)).toBeUndefined();
  });
});

test.describe("/api/logout", () => {
  test("clears the session cookie", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL, Seed.anita.username);
    try {
      expect(await sessionCookie(request), "logged in").toBeTruthy();
      const response = await request.post("/api/logout");
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["set-cookie"], "the cookie is expired by the response").toMatch(new RegExp(`${SESSION_COOKIE}=;?.*(Max-Age=0|Expires=)`, "i"));
      expect(await sessionCookie(request), "no session cookie left on the context").toBeUndefined();
      // The session is really gone: a signed-in-only route answers 401
      const like = await request.post("/api/goal-like", { data: { goalId: "00000000-0000-0000-0000-000000000000" } });
      expect(like.status(), await like.text()).toBe(401);
    }
    finally {
      await request.dispose();
    }
  });

  test("the removed password routes are gone", async ({ request }) => {
    for (const [method, url] of [["post", "/api/login"], ["post", "/api/signup"], ["post", "/api/password"], ["patch", "/api/verify"]] as const) {
      const response = await request[method](url, { data: {} });
      expect(response.status(), `${method.toUpperCase()} ${url}`).toBe(404);
    }
  });
});
