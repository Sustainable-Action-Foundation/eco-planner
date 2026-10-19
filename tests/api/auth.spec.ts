import { expect, test } from "playwright/test";
import type { APIRequestContext } from "playwright/test";
import { loginAs, mailToken, orgIdByName, requestAs, Seed, SESSION_COOKIE, startPageTitle, uniqueLabel } from "../lib/api";

/*
 * Session and account routes: /api/login, /api/logout, /api/signup, /api/verify,
 * /api/password. Mail is stubbed under TEST_ENVIRONMENT=testing and the token a
 * mail would carry is read back through /api/test/mail-token (see @/mailClient).
 *
 * Signed-up users cannot be deleted through the API, so every signup here uses a
 * unique username and a unique address under an allowlisted seed domain; the
 * accounts linger in the test DB until the next reseed.
 */

/** The session cookie of a request context, if any */
async function sessionCookie(request: APIRequestContext) {
  const state = await request.storageState();
  return state.cookies.find(cookie => cookie.name === SESSION_COOKIE);
}

/** A unique, URL-safe username (see isValidUsername): letters, digits, ".", "_", "-" */
function uniqueUsername(testInfo: Parameters<typeof uniqueLabel>[0], prefix: string): string {
  return uniqueLabel(testInfo, prefix).replace(/[^\p{L}\p{N}._-]+/gu, "-");
}

test.describe("/api/login and /api/logout", () => {
  test("a correct password starts a session in the eco_planner cookie", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const response = await request.post("/api/login", { data: { username: Seed.anita.username, password: Seed.anita.password } });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["set-cookie"], "set-cookie header").toContain(`${SESSION_COOKIE}=`);
      const cookie = await sessionCookie(request);
      expect(cookie?.value, "session cookie stored on the context").toBeTruthy();
      // A session cookie: no persisted expiry unless "remember" was asked for
      expect(cookie?.expires).toBe(-1);
    }
    finally {
      await request.dispose();
    }
  });

  test("remember=true makes the cookie persistent", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const response = await request.post("/api/login", { data: { username: Seed.anita.username, password: Seed.anita.password, remember: true } });
      expect(response.status(), await response.text()).toBe(200);
      const cookie = await sessionCookie(request);
      expect(cookie?.expires ?? -1, "persistent cookie expiry").toBeGreaterThan(Date.now() / 1000);
    }
    finally {
      await request.dispose();
    }
  });

  test("a wrong password is rejected without a session", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const response = await request.post("/api/login", { data: { username: Seed.anita.username, password: "not-the-password" } });
      expect(response.status(), await response.text()).toBe(400);
      expect(await sessionCookie(request)).toBeUndefined();
    }
    finally {
      await request.dispose();
    }
  });

  test("an unverified user cannot log in even with the right password", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const response = await request.post("/api/login", { data: { username: Seed.anton.username, password: Seed.anton.password } });
      expect(response.status(), await response.text()).toBe(400);
      expect(await sessionCookie(request)).toBeUndefined();
    }
    finally {
      await request.dispose();
    }
  });

  test("unknown, unverified and wrong-password logins get the same answer", async ({ request }) => {
    const attempts = [
      { username: "no-such-user-ever", password: "x" },
      { username: Seed.anton.username, password: Seed.anton.password },
      { username: Seed.anita.username, password: "not-the-password" },
    ];
    const answers = [];
    for (const data of attempts) {
      const response = await request.post("/api/login", { data });
      answers.push({ status: response.status(), body: await response.json() as unknown });
    }
    expect(answers[0].status).toBe(400);
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
  });

  test("a body that is not JSON is a 400", async ({ request }) => {
    const response = await request.post("/api/login", { data: "username=anita&password=anita", headers: { "content-type": "text/plain" } });
    expect(response.status(), await response.text()).toBe(400);
  });

  test("missing or non-string credentials are a 400", async ({ request }) => {
    for (const data of [{}, { username: "anita" }, { username: 1, password: "anita" }, [], null]) {
      const response = await request.post("/api/login", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(400);
    }
  });

  test("/api/logout clears the session cookie", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL, Seed.anita.username, Seed.anita.password);
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
});

test.describe("/api/signup rejections", () => {
  test("an email domain outside the allowlist is refused", async ({ request }, testInfo) => {
    const response = await request.post("/api/signup", {
      data: { username: uniqueUsername(testInfo, "notinvited"), email: `not.invited.${Date.now().toString(36)}@invite-test.example`, password: "password1234" },
    });
    expect(response.status(), await response.text()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("not allowed");
  });

  test("a taken username is refused before anything is created", async ({ request }) => {
    const response = await request.post("/api/signup", {
      data: { username: Seed.admin.username, email: `taken.username.${Date.now().toString(36)}@boden.se`, password: "password1234" },
    });
    expect(response.status(), await response.text()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("already taken");
  });

  test("a taken email is refused, case-insensitively", async ({ request }, testInfo) => {
    const response = await request.post("/api/signup", {
      data: { username: uniqueUsername(testInfo, "dupemail"), email: "Anita@Sustainable-Action.ngo", password: "password1234" },
    });
    expect(response.status(), await response.text()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("already in use");
  });

  test("a username with URL-breaking characters is refused", async ({ request }) => {
    const response = await request.post("/api/signup", {
      data: { username: "bad user@name", email: `bad.name.${Date.now().toString(36)}@boden.se`, password: "password1234" },
    });
    expect(response.status(), await response.text()).toBe(400);
  });

  test("a body missing a field is a 400", async ({ request }) => {
    const response = await request.post("/api/signup", { data: { username: "x", email: "x@boden.se" } });
    expect(response.status(), await response.text()).toBe(400);
  });
});

/*
 * One account through its whole life: signup (auto-joined by domain), locked until
 * verified, verified through the mailed token, then a password reset through its own
 * token. The steps share the account, hence serial.
 */
test.describe.serial("signup, verification and password reset", () => {
  const password = "password1234";
  const newPassword = "even-better-password-5678";
  let username = "";
  let email = "";
  /** The token that verified the account, replayed afterwards */
  let verificationHash = "";

  test("signup with an allowlisted seed domain creates an unverified member of that org", async ({ playwright, baseURL }, testInfo) => {
    username = uniqueUsername(testInfo, "signup");
    email = `test.${username.toLowerCase()}@boden.se`;
    const request = await requestAs(playwright, baseURL);
    try {
      const response = await request.post("/api/signup", { data: { username, email, password } });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["location"]).toBe("/verify");

      // Unverified: the account exists but cannot start a session yet
      const login = await request.post("/api/login", { data: { username, password } });
      expect(login.status(), await login.text()).toBe(400);
    }
    finally {
      await request.dispose();
    }
  });

  test("a resend request answers the same whether or not the address exists", async ({ request }) => {
    for (const address of [email, "nobody.at.all@boden.se"]) {
      const response = await request.post("/api/verify", { data: { email: address } });
      expect(response.status(), `${address}: ${await response.text()}`).toBe(200);
      expect(response.headers()["location"]).toBe("/verify");
    }
    const missing = await request.post("/api/verify", { data: {} });
    expect(missing.status(), await missing.text()).toBe(400);
  });

  test("the wrong token does not verify", async ({ request }) => {
    const response = await request.patch("/api/verify", { data: { email, hash: "0".repeat(64) } });
    expect(response.status(), await response.text()).toBe(400);
    const login = await request.post("/api/login", { data: { username, password } });
    expect(login.status(), "still unverified").toBe(400);
  });

  test("the mailed token verifies the account, which then logs in and sees its domain's org", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const hash = await mailToken(request, email);
      verificationHash = hash;
      const response = await request.patch("/api/verify", { data: { email, hash } });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["location"]).toBe("/login");

      await loginAs(request, username, password);
      // Auto-joined by domain: the start page is the landing of the org owning boden.se
      expect(await startPageTitle(request)).toBe("Bodens kommun");
      const bodenOrgId = await orgIdByName(request, "Bodens kommun");
      expect(await startPageTitle(request, `/?org=${bodenOrgId}`)).toBe("Bodens kommun");
    }
    finally {
      await request.dispose();
    }
  });

  test("a used verification token is no longer valid", async ({ request }) => {
    // The token hashes the user record (including is_verified), so it rotates on verification
    expect(verificationHash, "set by the verification step").toMatch(/^[0-9a-f]{64}$/);
    expect(await mailToken(request, email), "the current token").not.toBe(verificationHash);
    const response = await request.patch("/api/verify", { data: { email, hash: verificationHash } });
    expect(response.status(), await response.text()).toBe(400);
  });

  test("a reset request answers the same whether or not the address exists", async ({ request }) => {
    for (const address of [email, "nobody.at.all@boden.se"]) {
      const response = await request.post("/api/password", { data: { email: address } });
      expect(response.status(), `${address}: ${await response.text()}`).toBe(200);
      expect(response.headers()["location"]).toBe("/password");
    }
    const missing = await request.post("/api/password", { data: {} });
    expect(missing.status(), await missing.text()).toBe(400);
  });

  test("the mailed token sets a new password and invalidates the old one and itself", async ({ playwright, baseURL }) => {
    const request = await requestAs(playwright, baseURL);
    try {
      const wrong = await request.patch("/api/password", { data: { email, hash: "0".repeat(64), newPassword } });
      expect(wrong.status(), await wrong.text()).toBe(400);

      const hash = await mailToken(request, email);
      const response = await request.patch("/api/password", { data: { email, hash, newPassword } });
      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["location"]).toBe("/login");

      const oldLogin = await request.post("/api/login", { data: { username, password } });
      expect(oldLogin.status(), "old password").toBe(400);
      await loginAs(request, username, newPassword);

      // The token hashed the old password, so replaying it is refused
      const replay = await request.patch("/api/password", { data: { email, hash, newPassword: password } });
      expect(replay.status(), await replay.text()).toBe(400);
    }
    finally {
      await request.dispose();
    }
  });

  test("the reset body needs email, hash and newPassword", async ({ request }) => {
    const response = await request.patch("/api/password", { data: { email, hash: "x" } });
    expect(response.status(), await response.text()).toBe(400);
  });
});
