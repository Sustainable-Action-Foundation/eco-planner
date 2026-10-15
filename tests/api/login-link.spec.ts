import { expect, test as base } from "playwright/test";
import type { APIRequestContext, PlaywrightWorkerArgs } from "playwright/test";
import { orgIdByName, SESSION_COOKIE, startPageTitle } from "../lib/api";

/*
 * Passwordless login: POST /api/login-link mails a one-time link, PATCH redeems it.
 * Mail is stubbed under TEST_ENVIRONMENT=testing; the last mail per address is read
 * back through /api/test/outbox (see @/mailClient). The mail work runs after the
 * response (`after()`), so the outbox is polled.
 *
 * The route throttles per address (3, then ~1 per 5 min) and per client IP (10, then
 * ~1 per min; Next fills X-Forwarded-For from the socket when a client sends none), so
 * every request context here carries its own fake X-Forwarded-For, and "existing
 * users" are created through the link flow with unique addresses rather than seeded
 * ones, which would run out of budget across tests. Link-created accounts cannot be
 * deleted through the API; they linger under the allowlisted seed domain boden.se.
 */

const place = { orgName: "Bodens kommun", domain: "boden.se" };

let ipCounter = Math.floor(Math.random() * 0x10000);
/**
 * A fake client address unique to this worker and call (TEST-NET-2 is never routed).
 * The random start matters: the server's buckets outlive a test run, so a rerun
 * against the same server must not replay the addresses of the previous one.
 */
function uniqueIp(workerIndex: number): string {
  ipCounter++;
  return `198.51.${(workerIndex * 64 + (ipCounter >> 8)) & 255}.${ipCounter & 255}`;
}

/** A fresh, unauthenticated request context with its own client IP */
async function freshContext(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, workerIndex: number, ip = uniqueIp(workerIndex)): Promise<APIRequestContext> {
  // cimode, like the browser projects: mails then carry their keys, and the interpolations as JSON after "::"
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip, "accept-language": "cimode" } });
}

/** `request` with its own client IP per test, so the per-IP throttle never crosses tests */
const test = base.extend<{ request: APIRequestContext }>({
  request: async ({ playwright, baseURL }, use, testInfo) => {
    const context = await freshContext(playwright, baseURL, testInfo.workerIndex);
    await use(context);
    await context.dispose();
  },
});

/** A unique address under `domain` */
function uniqueEmail(prefix: string, domain = place.domain): string {
  return `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@${domain}`;
}

async function sessionCookie(request: APIRequestContext) {
  const state = await request.storageState();
  return state.cookies.find(cookie => cookie.name === SESSION_COOKIE);
}

type Outbox = { to: string, subject: string, text: string, sentAt: string };

/** The last mail to `email`, or null */
async function outbox(request: APIRequestContext, email: string): Promise<Outbox | null> {
  const response = await request.get(`/api/test/outbox?email=${encodeURIComponent(email)}`);
  if (response.status() === 404) return null;
  expect(response.status(), await response.text()).toBe(200);
  return await response.json() as Outbox;
}

/** The token from the `/login/link#t=…` URL in a mail (cimode renders the interpolation as JSON after `::`) */
function tokenIn(mail: Outbox): string | null {
  return mail.text.match(/\/login\/link#t=([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

/** Requests a link and waits for the mail; resolves with the token in it. */
async function requestLink(request: APIRequestContext, email: string, extra: Record<string, unknown> = {}): Promise<{ token: string, mail: Outbox }> {
  const before = (await outbox(request, email))?.sentAt;
  const response = await request.post("/api/login-link", { data: { email, ...extra } });
  expect(response.status(), await response.text()).toBe(200);
  let mail: Outbox = { to: "", subject: "", text: "", sentAt: "" };
  await expect.poll(async () => {
    const latest = await outbox(request, email);
    if (latest && latest.sentAt !== before) {
      mail = latest;
    }
    return mail.sentAt;
  }, { message: `a new mail to ${email}`, timeout: 15_000 }).toBeTruthy();
  const token = tokenIn(mail);
  expect(token, `token in: ${mail.text}`).toBeTruthy();
  return { token: token ?? "", mail };
}

/** Redeems a token on `request`; resolves with the response. */
async function redeem(request: APIRequestContext, token: string) {
  return request.patch("/api/login-link", { data: { token } });
}

/** Creates an account through the link flow (one request of the address's budget); the context stays logged out. */
async function newLinkUser(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, workerIndex: number, prefix = "user"): Promise<string> {
  const email = uniqueEmail(prefix);
  const context = await freshContext(playwright, baseURL, workerIndex);
  try {
    const { token } = await requestLink(context, email);
    const response = await redeem(context, token);
    expect(response.status(), `creating ${email}: ${await response.text()}`).toBe(200);
  }
  finally {
    await context.dispose();
  }
  return email;
}

/** Waits long enough for any `after()` work of earlier requests to have run */
async function settle(request: APIRequestContext) {
  // A control address that always gets a mail; when it arrives, earlier after() callbacks have run too
  await requestLink(request, uniqueEmail("settle"));
}

test.describe("POST /api/login-link", () => {
  test("a malformed body or address is a 400, nothing else is", async ({ request }) => {
    for (const data of [{}, { email: 5 }, { email: "not-an-address" }, { email: "a@b" }, [], null]) {
      const response = await request.post("/api/login-link", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(400);
    }
  });

  test("existing, unknown-but-allowed and not-allowed addresses all get the same answer", async ({ request, playwright, baseURL }, testInfo) => {
    const existing = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "same-answer");
    const answers = new Set<string>();
    for (const email of [existing, uniqueEmail("nobody"), uniqueEmail("stranger", "example.com")]) {
      const response = await request.post("/api/login-link", { data: { email } });
      expect(response.status(), `${email}: ${await response.text()}`).toBe(200);
      answers.add(await response.text());
    }
    expect([...answers], "one message for every kind of address").toHaveLength(1);
  });

  test("an existing user gets the login mail, an allowlisted stranger the welcome mail, others nothing", async ({ request, playwright, baseURL }, testInfo) => {
    const existing = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "Existing");
    const login = await requestLink(request, ` ${existing.toUpperCase()} `);
    expect(login.mail.subject).toContain("login.subject");
    expect(login.mail.to, "mailed to the normalized address").toBe(existing.toLowerCase());

    const newcomer = uniqueEmail("newcomer");
    const welcome = await requestLink(request, newcomer);
    expect(welcome.mail.subject).toContain("welcome.subject");
    expect(welcome.mail.text).toContain(newcomer.toLowerCase());

    const stranger = uniqueEmail("stranger", "example.com");
    const response = await request.post("/api/login-link", { data: { email: stranger } });
    expect(response.status()).toBe(200);
    await settle(request);
    expect(await outbox(request, stranger), "no mail outside the allowlist").toBeNull();
  });

  test("the per-address throttle is silent: the 4th request in a row answers 200 but sends nothing", async ({ request }) => {
    const email = uniqueEmail("throttled");
    let last = "";
    for (let i = 0; i < 3; i++) {
      last = (await requestLink(request, email)).mail.sentAt;
    }
    const response = await request.post("/api/login-link", { data: { email } });
    expect(response.status(), await response.text()).toBe(200);
    await settle(request);
    expect((await outbox(request, email))?.sentAt, "no 4th mail").toBe(last);
  });

  test("the per-IP throttle keys on the first X-Forwarded-For hop", async ({ request, playwright, baseURL }, testInfo) => {
    const ip = uniqueIp(testInfo.workerIndex);
    const sameIp = await freshContext(playwright, baseURL, testInfo.workerIndex, `${ip}, 10.0.0.1`);
    try {
      const mailed: string[] = [];
      for (let i = 0; i < 11; i++) {
        const email = uniqueEmail(`ip${i}`);
        const response = await sameIp.post("/api/login-link", { data: { email } });
        expect(response.status(), await response.text()).toBe(200);
        mailed.push(email);
      }
      await settle(request);
      const sent = (await Promise.all(mailed.map(email => outbox(request, email)))).filter(Boolean);
      expect(sent, "10 of 11 requests from one IP got a mail").toHaveLength(10);
    }
    finally {
      await sameIp.dispose();
    }
  });
});

test.describe("PATCH /api/login-link", () => {
  test("a missing or unknown token is a 400 without a session", async ({ request }) => {
    for (const data of [{}, { token: "" }, { token: 5 }, { token: "A".repeat(43) }]) {
      const response = await request.patch("/api/login-link", { data });
      expect(response.status(), `${JSON.stringify(data)} -> ${await response.text()}`).toBe(400);
    }
    expect(await sessionCookie(request)).toBeUndefined();
  });

  test("redeeming logs an existing user in once; the link is then spent", async ({ request, playwright, baseURL }, testInfo) => {
    const email = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "redeem");
    const { token } = await requestLink(request, email);
    const response = await redeem(request, token);
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json() as { redirect: string }).redirect).toBe("/");
    expect(response.headers()["location"]).toBe("/");
    const cookie = await sessionCookie(request);
    expect(cookie?.value, "session cookie").toBeTruthy();
    const daysLeft = ((cookie?.expires ?? -1) - Date.now() / 1000) / (24 * 60 * 60);
    expect(daysLeft, "the default 30-day login without remember").toBeGreaterThan(29);
    expect(daysLeft).toBeLessThanOrEqual(31);
    // Auto-joined by domain at creation: the start page is the landing of the org owning boden.se
    expect(await startPageTitle(request)).toBe(place.orgName);

    const replay = await redeem(request, token);
    expect(replay.status(), "single use").toBe(400);
  });

  test("remember=true gives a persistent cookie and from= decides the redirect, sanitized", async ({ request, playwright, baseURL }, testInfo) => {
    const email = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "remember");
    const { token } = await requestLink(request, email, { remember: true, from: "/roadmap/create" });
    const response = await redeem(request, token);
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json() as { redirect: string }).redirect).toBe("/roadmap/create");
    const rememberedDays = (((await sessionCookie(request))?.expires ?? -1) - Date.now() / 1000) / (24 * 60 * 60);
    expect(rememberedDays, "a year with remember").toBeGreaterThan(300);

    const evil = await freshContext(playwright, baseURL, testInfo.workerIndex);
    try {
      const open = await requestLink(evil, email, { from: "//evil.example/x" });
      const refused = await redeem(evil, open.token);
      expect(refused.status(), await refused.text()).toBe(200);
      expect((await refused.json() as { redirect: string }).redirect, "open redirect refused").toBe("/");
    }
    finally {
      await evil.dispose();
    }
  });

  test("a new request replaces the pending link", async ({ request, playwright, baseURL }, testInfo) => {
    const email = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "replace");
    const first = await requestLink(request, email);
    const second = await requestLink(request, email);
    expect(second.token).not.toBe(first.token);
    expect((await redeem(request, first.token)).status(), "the replaced link no longer works").toBe(400);
    expect((await redeem(request, second.token)).status(), "the current one does").toBe(200);
  });

  test("the first login on an allowlisted domain creates a verified member of the domain's org", async ({ request }) => {
    const email = uniqueEmail("First.Login");
    const { token } = await requestLink(request, email);
    const response = await redeem(request, token);
    expect(response.status(), await response.text()).toBe(200);
    expect(await sessionCookie(request), "logged in").toBeTruthy();
    expect(await startPageTitle(request)).toBe(place.orgName);
    const orgId = await orgIdByName(request, place.orgName);
    expect(await startPageTitle(request, `/?org=${orgId}`)).toBe(place.orgName);

    // The derived username (the address's local part) has a profile page
    const localPart = email.split("@")[0].toLowerCase();
    const profile = await request.get(`/user/${encodeURIComponent(localPart)}`);
    expect(profile.status()).toBe(200);
    expect(await profile.text()).toContain(localPart);

    // Verified on creation: the next link is a plain login
    const again = await requestLink(request, email);
    expect(again.mail.subject, "now an existing user").toContain("login.subject");
  });

  test("a link-created account has no password: password login is refused like any bad login", async ({ request, playwright, baseURL }, testInfo) => {
    const email = await newLinkUser(playwright, baseURL, testInfo.workerIndex, "nopassword");
    const username = email.split("@")[0];
    for (const password of ["", "anything", "null"]) {
      const login = await request.post("/api/login", { data: { username, password } });
      expect(login.status(), JSON.stringify(password)).toBe(400);
    }
    expect(await sessionCookie(request)).toBeUndefined();
  });

  test("a link also verifies a user who never clicked their verification mail", async ({ request }) => {
    // A password signup is unverified until its mail is followed; a login link proves the address just as well
    const email = uniqueEmail("unverified");
    const username = email.split("@")[0];
    const password = "password1234";
    const signup = await request.post("/api/signup", { data: { username, email, password } });
    expect(signup.status(), await signup.text()).toBe(200);
    expect((await request.post("/api/login", { data: { username, password } })).status(), "unverified: no password login yet").toBe(400);

    const { token } = await requestLink(request, email);
    const response = await redeem(request, token);
    expect(response.status(), await response.text()).toBe(200);
    expect(await sessionCookie(request), "logged in").toBeTruthy();

    // Verified by the link: the password now works too
    const fresh = await request.post("/api/logout");
    expect(fresh.status()).toBe(200);
    expect((await request.post("/api/login", { data: { username, password } })).status(), "verified").toBe(200);
  });
});
