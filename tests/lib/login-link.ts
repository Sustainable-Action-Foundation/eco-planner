import { expect } from "playwright/test";
import type { APIRequestContext, PlaywrightWorkerArgs } from "playwright/test";

/*
 * Helpers for the passwordless flow (POST/PATCH /api/login-link) and the stubbed
 * outbox behind it (/api/test/outbox, TEST_ENVIRONMENT only). The route throttles per
 * address and per client IP (Next fills X-Forwarded-For from the socket when a client
 * sends none), so every context made here carries its own fake client address and
 * specs create their own users under the allowlisted seed domain instead of spending
 * seeded users' budget.
 */

/** Seeded place whose domain is both allowlisted and owned by an org (scripts/prisma/seed/places.ts) */
export const linkPlace = { orgName: "Bodens kommun", domain: "boden.se" };

let ipCounter = Math.floor(Math.random() * 0x10000);
/**
 * A fake client address unique to this worker and call (TEST-NET-2 is never routed).
 * The random start matters: the server's throttle buckets outlive a test run, so a rerun
 * against the same server must not replay the addresses of the previous one.
 */
export function uniqueIp(workerIndex: number): string {
  ipCounter++;
  return `198.51.${(workerIndex * 64 + (ipCounter >> 8)) & 255}.${ipCounter & 255}`;
}

/** A fresh, unauthenticated request context with its own client IP, in cimode like the browser projects */
export async function freshContext(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, workerIndex: number, ip = uniqueIp(workerIndex)): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip, "accept-language": "cimode" } });
}

/** A unique address under `domain` */
export function uniqueEmail(prefix: string, domain = linkPlace.domain): string {
  return `${prefix}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@${domain}`;
}

export type Outbox = { to: string, subject: string, text: string, sentAt: string };

/** The last stubbed mail to `email`, or null */
export async function outbox(request: APIRequestContext, email: string): Promise<Outbox | null> {
  const response = await request.get(`/api/test/outbox?email=${encodeURIComponent(email)}`);
  if (response.status() === 404) return null;
  expect(response.status(), await response.text()).toBe(200);
  return await response.json() as Outbox;
}

/** The token from the `/login/link#t=…` URL in a mail (cimode renders the interpolation as JSON after `::`) */
export function tokenIn(mail: Outbox): string | null {
  return mail.text.match(/\/login\/link#t=([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

/** Requests a link and waits for the mail (the work runs in `after()`); resolves with the token in it. */
export async function requestLink(request: APIRequestContext, email: string, extra: Record<string, unknown> = {}): Promise<{ token: string, mail: Outbox }> {
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
export async function redeem(request: APIRequestContext, token: string) {
  return request.patch("/api/login-link", { data: { token } });
}

/** Logs `request` in as `email` through a link (one request of the address's budget). */
export async function linkLogin(request: APIRequestContext, email: string): Promise<void> {
  const { token } = await requestLink(request, email);
  const response = await redeem(request, token);
  expect(response.status(), `link login of ${email}: ${await response.text()}`).toBe(200);
}

/** The name the test suite gives a link-created user: "<Prefix> Testsson" */
export function testName(prefix: string): { firstName: string, lastName: string } {
  const first = prefix.replace(/[^\p{L}\p{N}]+/gu, " ").trim() || "Test";
  return { firstName: first.charAt(0).toUpperCase() + first.slice(1), lastName: "Testsson" };
}

/** Completes onboarding for the context's user: sets first and last name (PATCH /api/user). */
export async function onboard(request: APIRequestContext, name: { firstName: string, lastName: string }): Promise<void> {
  const response = await request.patch("/api/user", { data: name });
  expect(response.status(), `onboarding: ${await response.text()}`).toBe(200);
}

/**
 * Creates an account through the link flow with a unique address; the returned context is
 * logged in as it. The user is onboarded (named) unless `onboarded` is false, so later
 * logins redirect straight to their target instead of to /welcome.
 */
export async function newLinkUser(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, workerIndex: number, prefix = "user", onboarded = true): Promise<{ email: string, request: APIRequestContext, name: { firstName: string, lastName: string } }> {
  const email = uniqueEmail(prefix);
  const request = await freshContext(playwright, baseURL, workerIndex);
  await linkLogin(request, email);
  const name = testName(prefix);
  if (onboarded) {
    await onboard(request, name);
  }
  return { email, request, name };
}
