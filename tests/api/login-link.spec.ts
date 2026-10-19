import { expect, test as base } from "playwright/test";
import type { APIRequestContext, PlaywrightWorkerArgs } from "playwright/test";
import { orgIdByName, SESSION_COOKIE, startPageTitle } from "../lib/api";
import { freshContext, linkPlace, newLinkUser as createLinkUser, outbox, redeem, requestLink, uniqueEmail, uniqueIp } from "../lib/login-link";

/*
 * Passwordless login: POST /api/login-link mails a one-time link, PATCH redeems it.
 * Mail is stubbed under TEST_ENVIRONMENT=testing and read back through
 * /api/test/outbox; see tests/lib/login-link.ts for the helpers and for why every
 * context has its own client IP and every test its own link-created users.
 */

const place = linkPlace;

/** `request` with its own client IP per test, so the per-IP throttle never crosses tests */
const test = base.extend<{ request: APIRequestContext }>({
  request: async ({ playwright, baseURL }, use, testInfo) => {
    const context = await freshContext(playwright, baseURL, testInfo.workerIndex);
    await use(context);
    await context.dispose();
  },
});

async function sessionCookie(request: APIRequestContext) {
  const state = await request.storageState();
  return state.cookies.find(cookie => cookie.name === SESSION_COOKIE);
}

/** Creates an account through the link flow; resolves with its address (the creating context is disposed, so nothing stays logged in). */
async function newLinkUser(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, workerIndex: number, prefix = "user"): Promise<string> {
  const created = await createLinkUser(playwright, baseURL, workerIndex, prefix);
  await created.request.dispose();
  return created.email;
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

  test("the per-IP throttle keys on the last X-Forwarded-For hop (the one the proxy appends)", async ({ request, playwright, baseURL }, testInfo) => {
    const ip = uniqueIp(testInfo.workerIndex);
    // A client-supplied first hop must not become the key: the prod proxy appends the real address after it
    const sameIp = await freshContext(playwright, baseURL, testInfo.workerIndex, `203.0.113.7, ${ip}`);
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
});
