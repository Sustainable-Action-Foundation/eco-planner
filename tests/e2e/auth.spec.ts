import { expect, test } from "playwright/test";
import type { APIRequestContext, Page, TestInfo } from "playwright/test";
import { loginAs, Seed, SESSION_COOKIE, uniqueLabel } from "../lib/api";
import { visible } from "../lib/forms";

/*
 * Browser auth flows: the login form, logout, signup through the mailed
 * verification link, and the mailed password reset. Every test starts without
 * stored state (the setup project's states are for the other specs).
 *
 * Mail never leaves the test server: under TEST_ENVIRONMENT=testing the mail
 * client is a no-op and `/api/test/mail-token` hands out the hash the mail
 * would have carried. Signed-up users cannot be deleted through the API, so
 * each run leaves one `e2e-*@boden.se` user behind (unique per project, retry
 * and run).
 */

test.use({ storageState: { cookies: [], origins: [] } });

/** Seeded place whose domain is both allowlisted and owned by an org (scripts/prisma/seed/places.ts) */
const place = { orgName: "Bodens kommun", domain: "boden.se" };
/** A domain outside src/lib/allowedDomains.ts */
const strangerDomain = "example.com";

/** uniqueLabel() with the characters a username may not contain folded away (src/functions/username.ts) */
function uniqueUsername(testInfo: TestInfo): string {
  return uniqueLabel(testInfo, "e2e").toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "-");
}

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find(cookie => cookie.name === SESSION_COOKIE);
}

/** Fills the login form and submits it; resolves with the `/api/login` status. */
async function submitLogin(page: Page, username: string, password: string, remember = false): Promise<number> {
  await visible(page, "#username").fill(username);
  await visible(page, "#password").fill(password);
  if (remember) await visible(page, "#remember").check();
  const response = page.waitForResponse(res => res.url().endsWith("/api/login") && res.request().method() === "POST");
  await visible(page, "#submit-button").click();
  return (await response).status();
}

/** The inline error box under the login form; it is always in the DOM and fades in on failure */
function loginError(page: Page) {
  return page.getByTestId("login-error-message").filter({ visible: true });
}

/**
 * The hash a verification/reset mail would have linked to, from the test-only
 * route (gated on TEST_ENVIRONMENT=testing). Mail is a no-op in that env, so
 * this is the only way the browser flow gets at the token.
 */
async function mailToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(`/api/test/mail-token?email=${encodeURIComponent(email)}`);
  expect(response.status(), `mail token for ${email}: ${await response.text()}`).toBe(200);
  const body = await response.json() as { hash?: string, token?: string };
  const hash = body.hash ?? body.token;
  expect(typeof hash, "mail token body").toBe("string");
  return hash ?? "";
}

/** Captures the next `alert()`; the signup form reports rejections that way */
function nextAlert(page: Page): Promise<string> {
  return new Promise(resolve => page.once("dialog", dialog => {
    const message = dialog.message();
    dialog.dismiss().then(() => resolve(message)).catch(() => resolve(message));
  }));
}

/** Submits the signup form; resolves with the `/api/signup` response. */
async function submitSignup(page: Page, user: { username: string, email: string, password: string }) {
  await page.goto("/signup");
  await visible(page, "#username").fill(user.username);
  await visible(page, "#email").fill(user.email);
  await visible(page, "#password").fill(user.password);
  const response = page.waitForResponse(res => res.url().endsWith("/api/signup") && res.request().method() === "POST");
  await visible(page, "#submit-button").click();
  return await response;
}

test.describe("Login form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("empty submit is stopped by the required fields", async ({ page }) => {
    let requests = 0;
    page.on("request", request => { if (request.url().endsWith("/api/login")) requests++; });

    await visible(page, "#submit-button").click();

    await expect.poll(() => page.locator("form:invalid").filter({ visible: true }).count()).toBeGreaterThan(0);
    await expect(visible(page, "#username:invalid")).toHaveCount(1);
    // Nothing reached the API, so the inline error stays faded out
    await expect(loginError(page)).toHaveClass(/opacity-0/);
    expect(requests).toBe(0);
  });

  test("wrong password shows the inline error", async ({ page }) => {
    expect(await submitLogin(page, Seed.anita.username, "not-the-password")).toBe(400);

    await expect(loginError(page)).toHaveClass(/opacity-1/);
    await expect(loginError(page)).toHaveText(/login\.invalid_credentials/);
    await expect(page.getByTestId("logout-button")).toHaveCount(0);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("unverified user cannot log in", async ({ page }) => {
    expect(await submitLogin(page, Seed.anton.username, Seed.anton.password)).toBe(400);

    await expect(loginError(page)).toHaveClass(/opacity-1/);
    await expect(loginError(page)).toHaveText(/login\.invalid_credentials/);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("successful login shows the logout button with a 30-day session cookie", async ({ page }) => {
    expect(await submitLogin(page, Seed.anita.username, Seed.anita.password)).toBe(200);

    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
    await expect(page).toHaveURL("/");
    const cookie = await sessionCookie(page);
    expect(cookie).toBeDefined();
    // Without "remember me" the login lasts 30 days (src/lib/session.ts)
    const daysLeft = ((cookie?.expires ?? -1) - Date.now() / 1000) / (24 * 60 * 60);
    expect(daysLeft).toBeGreaterThan(29);
    expect(daysLeft).toBeLessThanOrEqual(31);
  });

  test("remember me sets an expiring cookie", async ({ page }) => {
    expect(await submitLogin(page, Seed.anita.username, Seed.anita.password, true)).toBe(200);

    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
    const cookie = await sessionCookie(page);
    expect(cookie).toBeDefined();
    // /api/login sets maxAge to a year; allow for clock drift and a slow run
    const daysLeft = ((cookie?.expires ?? 0) - Date.now() / 1000) / (24 * 60 * 60);
    expect(daysLeft).toBeGreaterThan(300);
    expect(daysLeft).toBeLessThanOrEqual(366);
  });
});

test("logout removes the session cookie and the start page offers login again", async ({ page }) => {
  await loginAs(page.request, Seed.anita.username, Seed.anita.password);
  await page.goto("/");
  expect(await sessionCookie(page)).toBeDefined();

  const logout = page.waitForResponse(res => res.url().endsWith("/api/logout"));
  await page.getByTestId("logout-button").filter({ visible: true }).click();
  expect((await logout).status()).toBe(200);

  // The sidebar swaps the logout button for the login link once the session is gone
  await expect(page.locator('a[href="/login"]').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByTestId("logout-button")).toHaveCount(0);
  await expect.poll(() => sessionCookie(page)).toBeUndefined();
  // The public start page, not an org landing
  await expect(page.getByTestId("home-title").filter({ visible: true })).toHaveText("home.title");
});

test.describe("Signup rejections", () => {
  test("duplicate username is rejected", async ({ page }, testInfo) => {
    const alert = nextAlert(page);
    const response = await submitSignup(page, {
      username: Seed.anita.username,
      email: `${uniqueUsername(testInfo)}@${place.domain}`,
      password: "password",
    });

    expect(response.status()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("already taken");
    expect(await alert).toContain("signup.signup_failed_motivated");
    await expect(page).toHaveURL("/signup");
  });

  test("email outside the allowlist is rejected", async ({ page }, testInfo) => {
    const username = uniqueUsername(testInfo);
    const alert = nextAlert(page);
    const response = await submitSignup(page, {
      username,
      email: `${username}@${strangerDomain}`,
      password: "password",
    });

    expect(response.status()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("not allowed");
    expect(await alert).toContain("signup.signup_failed_motivated");
    await expect(page).toHaveURL("/signup");

    // Nothing was created: the username is still free for the API
    const retry = await page.request.post("/api/login", { data: { username, password: "password" } });
    expect(retry.status()).toBe(400);
  });
});

test.describe.serial("Signup, verification and password reset", () => {
  // One throwaway user per project/retry/run; it stays in the DB (no delete API for users)
  const user = { username: "", email: "", password: "first-password", newPassword: "second-password" };

  test.beforeAll(({ }, testInfo) => {
    user.username = uniqueUsername(testInfo);
    user.email = `${user.username}@${place.domain}`;
  });

  test("signup creates an unverified user and lands on the verify page", async ({ page }) => {
    const response = await submitSignup(page, user);
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json() as { message: string }).message).toBe("User created");

    await expect(page).toHaveURL("/verify");
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("verify.title");

    // Unverified until the mailed link is followed
    const login = await page.request.post("/api/login", { data: { username: user.username, password: user.password } });
    expect(login.status()).toBe(400);
  });

  test("duplicate email is rejected", async ({ page }, testInfo) => {
    const alert = nextAlert(page);
    const response = await submitSignup(page, { username: `${uniqueUsername(testInfo)}-dupe`, email: user.email, password: "password" });

    expect(response.status()).toBe(400);
    expect((await response.json() as { message: string }).message).toContain("already in use");
    expect(await alert).toContain("signup.signup_failed_motivated");
  });

  test("the verification link verifies the user, who lands in the place org", async ({ page }) => {
    const hash = await mailToken(page.request, user.email);
    // The link as src/app/api/signup/route.ts mails it (public/locales/*/email.json)
    await page.goto(`/verify/confirm?email=${encodeURIComponent(user.email)}&hash=${hash}`);

    const verify = page.waitForResponse(res => res.url().endsWith("/api/verify") && res.request().method() === "PATCH");
    await page.getByRole("button", { name: "verify_confirm.submit" }).filter({ visible: true }).click();
    expect((await verify).status()).toBe(200);
    // formSubmitter follows the Location header
    await expect(page).toHaveURL("/login");

    expect(await submitLogin(page, user.username, user.password)).toBe(200);
    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();

    // Auto-joined by email domain: the start page is the place's org landing
    await expect(page.getByTestId("home-title").filter({ visible: true })).toHaveText(place.orgName);
    await expect(page.locator('nav[aria-label*="org_nav_label"]').filter({ visible: true }).getByRole("link", { name: place.orgName })).toBeVisible();
  });

  test("the reset link sets a new password that logs in", async ({ page }) => {
    // The form only submits through its React onSubmit: a click that lands before hydration
    // (seen on Firefox) does a native submit instead, so retry until the request goes out.
    // A second request only mints a newer token, and mailToken reads the latest one.
    let status = 0;
    await expect(async () => {
      await page.goto("/password");
      await visible(page, "#email").fill(user.email);
      const request = page.waitForResponse(res => res.url().endsWith("/api/password") && res.request().method() === "POST", { timeout: 5_000 });
      await page.getByRole("button", { name: "password.submit" }).filter({ visible: true }).click();
      status = (await request).status();
    }).toPass({ timeout: 45_000 });
    expect(status).toBe(200);

    const hash = await mailToken(page.request, user.email);
    // The request form reloads /password after the 200 (formSubmitter follows Location),
    // which would cut off a navigation here; follow the link in a tab of its own
    const resetPage = await page.context().newPage();
    // Same hydration race as above; a retry only happens when no request went out, so the token is still unused
    let resetStatus = 0;
    await expect(async () => {
      await resetPage.goto(`/password/reset?email=${encodeURIComponent(user.email)}&hash=${hash}`);
      await visible(resetPage, "#password").fill(user.newPassword);
      const reset = resetPage.waitForResponse(res => res.url().endsWith("/api/password") && res.request().method() === "PATCH", { timeout: 5_000 });
      await resetPage.getByRole("button", { name: "password_reset.submit" }).filter({ visible: true }).click();
      resetStatus = (await reset).status();
    }).toPass({ timeout: 45_000 });
    expect(resetStatus).toBe(200);
    await expect(resetPage).toHaveURL("/login");

    // The old password is gone, the new one works
    const stale = await resetPage.request.post("/api/login", { data: { username: user.username, password: user.password } });
    expect(stale.status()).toBe(400);
    expect(await submitLogin(resetPage, user.username, user.newPassword)).toBe(200);
    await expect(resetPage.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
  });
});
