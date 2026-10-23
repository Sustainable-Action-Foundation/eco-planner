import { expect, test as base } from "playwright/test";
import type { APIRequestContext, Page } from "playwright/test";
import { loginAs, Seed, SESSION_COOKIE } from "../lib/api";
import { linkLogin, linkPlace, newLinkUser, outbox, requestLink, tokenIn, uniqueEmail, uniqueIp } from "../lib/login-link";
import { visible } from "../lib/forms";

/*
 * Browser auth flows: requesting a login link from /login and /signup, the
 * /login/link interstitial that redeems it, and logout. Every test starts without
 * stored state (the setup project's states are for the other specs).
 *
 * Mail never leaves the test server: under TEST_ENVIRONMENT=testing the mail client
 * records the last mail per address and /api/test/outbox hands it back. Link-created
 * users cannot be deleted through the API, so each run leaves a few `e2e-*@boden.se`
 * users behind (unique per project, retry and run).
 *
 * The link route throttles per client IP, and every browser here would otherwise
 * share the test server's view of one address, so each test's context presents its
 * own X-Forwarded-For (see tests/lib/login-link.ts).
 */

const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": uniqueIp(testInfo.workerIndex) });
    await use(context);
  },
});

test.use({ storageState: { cookies: [], origins: [] } });

/** Seeded place whose domain is both allowlisted and owned by an org (scripts/prisma/seed/places.ts) */
const place = linkPlace;
/** A domain outside src/lib/allowedDomains.ts */
const strangerDomain = "example.com";

async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find(cookie => cookie.name === SESSION_COOKIE);
}

/** Days until the session cookie expires */
function daysLeft(expires: number | undefined): number {
  return ((expires ?? -1) - Date.now() / 1000) / (24 * 60 * 60);
}

/** Fills the email form on the current page and submits it; resolves with the `/api/login-link` status. */
async function submitEmail(page: Page, email: string, remember = false): Promise<number> {
  await visible(page, "#email").fill(email);
  if (remember) await visible(page, "#remember").check();
  const response = page.waitForResponse(res => res.url().endsWith("/api/login-link") && res.request().method() === "POST");
  await visible(page, "#submit-button").click();
  return (await response).status();
}

/** The "check your inbox" panel that replaces the form after a request */
function sentPanel(page: Page) {
  return page.getByTestId("login-link-sent").filter({ visible: true });
}

/** The inline error box under the form; it is always in the DOM and fades in on failure */
function loginError(page: Page) {
  return page.getByTestId("login-error-message").filter({ visible: true });
}

/** Waits for a mail to `email` newer than `after` and returns the token in it */
async function mailedToken(request: APIRequestContext, email: string, after?: string): Promise<{ token: string, subject: string }> {
  let subject = "";
  let token: string | null = null;
  await expect.poll(async () => {
    const mail = await outbox(request, email);
    if (mail && mail.sentAt !== after) {
      subject = mail.subject;
      token = tokenIn(mail);
    }
    return token;
  }, { message: `a login link mailed to ${email}`, timeout: 15_000 }).toBeTruthy();
  return { token: token ?? "", subject };
}

/** Opens the mailed link and clicks through the interstitial; resolves with the PATCH status. */
async function redeemInBrowser(page: Page, token: string): Promise<number> {
  await page.goto(`/login/link#t=${token}`);
  const button = page.getByRole("button", { name: "login_link.submit" }).filter({ visible: true });
  await expect(button).toBeVisible();
  // The token is scrubbed from the address bar before anything else happens
  expect(page.url()).not.toContain("#");
  const response = page.waitForResponse(res => res.url().endsWith("/api/login-link") && res.request().method() === "PATCH");
  await button.click();
  return (await response).status();
}

test.describe("Login form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("empty submit is stopped by the required field", async ({ page }) => {
    let requests = 0;
    page.on("request", request => { if (request.url().endsWith("/api/login-link")) requests++; });

    await visible(page, "#submit-button").click();

    await expect.poll(() => page.locator("form:invalid").filter({ visible: true }).count()).toBeGreaterThan(0);
    await expect(visible(page, "#email:invalid")).toHaveCount(1);
    // Nothing reached the API, so the inline error stays faded out
    await expect(loginError(page)).toHaveClass(/opacity-0/);
    expect(requests).toBe(0);
  });

  test("an address the server cannot use shows the inline error", async ({ page }) => {
    // Browsers accept "a@b" as an email; the route wants a dot after the @
    expect(await submitEmail(page, "nobody@localhost")).toBe(400);

    await expect(loginError(page)).toHaveClass(/opacity-1/);
    await expect(loginError(page)).toHaveText(/login\.invalid_email/);
    await expect(sentPanel(page)).toHaveCount(0);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("the inbox panel reads the same for an allowlisted stranger and an unknown domain", async ({ page }) => {
    const stranger = uniqueEmail("e2e-stranger", strangerDomain);
    expect(await submitEmail(page, stranger)).toBe(200);
    await expect(sentPanel(page)).toBeVisible();
    await expect(sentPanel(page).getByRole("status")).toContainText(stranger);
    // Nothing was logged in, nothing was mailed (a control request settles the route's deferred work first)
    expect(await sessionCookie(page)).toBeUndefined();
    await requestLink(page.request, uniqueEmail("e2e-settle"));
    expect(await outbox(page.request, stranger), "no mail outside the allowlist").toBeNull();

    // Back to the form, prefilled, for the next address
    await sentPanel(page).getByRole("button", { name: "login.other_address" }).click();
    await expect(visible(page, "#email")).toHaveValue(stranger);
    await visible(page, "#email").clear();
    const newcomer = uniqueEmail("e2e-newcomer");
    expect(await submitEmail(page, newcomer)).toBe(200);
    await expect(sentPanel(page).getByRole("status")).toContainText(newcomer);
    const { subject } = await mailedToken(page.request, newcomer);
    expect(subject, "a first-time address gets the welcome mail").toContain("welcome.subject");
  });
});

test("the link page needs the token from the mail", async ({ page }) => {
  await page.goto("/login/link");
  await expect(page.getByTestId("login-link-error").filter({ visible: true })).toHaveText(/login_link\.missing/);
  await expect(page.getByRole("link", { name: "login_link.back_to_login" }).filter({ visible: true })).toHaveAttribute("href", "/login");
});

test.describe.serial("An account through a link", () => {
  // One throwaway user per project/retry/run; it stays in the DB (no delete API for users)
  const email = uniqueEmail("e2e-link");

  test("signup mails a welcome link that creates the account and lands in the place org", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("signup.create_account");
    expect(await submitEmail(page, email)).toBe(200);
    await expect(sentPanel(page)).toBeVisible();
    const { token, subject } = await mailedToken(page.request, email);
    expect(subject).toContain("welcome.subject");

    expect(await redeemInBrowser(page, token)).toBe(200);
    // Onboarding first: the name is asked once, then the login continues to its target
    await expect(page).toHaveURL("/welcome?from=%2F");
    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
    await visible(page, "#firstName").fill("Elin");
    await visible(page, "#lastName").fill("Exempelsson");
    const saved = page.waitForResponse(res => res.url().endsWith("/api/user") && res.request().method() === "PATCH");
    await visible(page, "#save-name").click();
    expect((await saved).status()).toBe(200);
    await expect(page).toHaveURL("/");
    // Without "remember me" the login lasts 30 days (src/lib/session.ts)
    const cookie = await sessionCookie(page);
    expect(daysLeft(cookie?.expires)).toBeGreaterThan(29);
    expect(daysLeft(cookie?.expires)).toBeLessThanOrEqual(31);

    // Auto-joined by email domain: the start page is the place's org landing
    await expect(page.getByTestId("home-title").filter({ visible: true })).toHaveText(place.orgName);
    await expect(page.locator('nav[aria-label*="org_nav_label"]').filter({ visible: true }).getByRole("link", { name: place.orgName })).toBeVisible();

    // The name is what the profile shows now, and it can be edited there
    await page.goto(`/user/${encodeURIComponent(email.split("@")[0])}`);
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("Elin Exempelsson");
    await expect(page.getByTestId("name-section").filter({ visible: true }).locator("#firstName")).toHaveValue("Elin");

    // The link was spent by the redemption
    expect(await redeemInBrowser(page, token)).toBe(400);
    await expect(page.getByTestId("login-link-error").filter({ visible: true })).toHaveText(/login_link\.invalid/);
  });

  test("logging in again with remember me and a from= target", async ({ page }) => {
    // Anonymous visitors to a create page are sent to /login with the page as from=
    await page.goto("/roadmap/create");
    await expect(page).toHaveURL(/\/login\?from=%2Froadmap%2Fcreate/);
    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toHaveText("tsx.login");

    const before = (await outbox(page.request, email))?.sentAt;
    expect(await submitEmail(page, email, true)).toBe(200);
    const { token, subject } = await mailedToken(page.request, email, before);
    expect(subject, "an existing user gets the login mail").toContain("login.subject");

    expect(await redeemInBrowser(page, token)).toBe(200);
    // Onboarded already: straight to the target
    await expect(page).toHaveURL("/roadmap/create");
    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
    // Remembered: the cookie lasts a year
    expect(daysLeft((await sessionCookie(page))?.expires)).toBeGreaterThan(300);
  });
});

test("logout removes the session cookie and the start page offers login again", async ({ page }) => {
  await loginAs(page.request, Seed.anita.username);
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

test("log out everywhere from the profile page signs out this browser and the other device", async ({ page, playwright, baseURL }, testInfo) => {
  // The "other device" is an API context logged in as the same link-created user
  const { email, request: phone } = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "e2e-everywhere");
  try {
    await linkLogin(page.request, email);
    const username = email.split("@")[0];
    await page.goto(`/user/${encodeURIComponent(username)}`);
    const section = page.getByTestId("sessions-section").filter({ visible: true });
    await expect(section).toBeVisible();
    await section.getByTestId("logout-everywhere-button").click();

    const logout = page.waitForResponse(res => res.url().endsWith("/api/logout") && res.request().method() === "POST");
    await page.getByTestId("logout-everywhere-confirm").filter({ visible: true }).click();
    expect((await logout).status()).toBe(200);

    // This browser is logged out and sent home
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("logout-button")).toHaveCount(0);
    await expect.poll(() => sessionCookie(page)).toBeUndefined();
    // The other device still holds its cookie, but the server no longer honours it
    const like = await phone.post("/api/goal-like", { data: { goalId: "00000000-0000-0000-0000-000000000000" } });
    expect(like.status(), "the other device is logged out").toBe(401);
  }
  finally {
    await phone.dispose();
  }
});
