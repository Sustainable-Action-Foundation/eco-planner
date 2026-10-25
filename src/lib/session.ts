import type { IronSession, SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { cache } from "react";
import type { LoginData } from "@/types";
import { prisma } from "@/lib/prisma";


/** Name of the session cookie */
export const SessionCookieName = "eco_planner";
/** How long a login lasts by default, in seconds: 30 days. */
export const sessionLifetimeSeconds = 30 * 24 * 60 * 60;
/** How long a login lasts with "remember me", in seconds: a year. */
export const rememberedSessionLifetimeSeconds = 365 * 24 * 60 * 60;

/**
 * Options for a given lifetime. Both the cookie's maxAge and the seal's ttl are set:
 * iron-session only derives one from the other when maxAge is left out, so a maxAge
 * alone would leave the seal at the 14-day default and log the user out early.
 */
function optionsWithLifetime(seconds: number): SessionOptions {
  return {
    // Compilation works fine without the password environment variable, but it will crash at runtime if it's not set.
    // This is intentional to allow building the project without the password, and then setting it when deploying/running.
    password: process.env.IRON_SESSION_PASSWORD ?? "",
    cookieName: SessionCookieName,
    ttl: seconds,
    cookieOptions: {
      maxAge: seconds,
      // Uses https in production and http in development
      secure: process.env.NODE_ENV === "production" && process.env.TEST_ENVIRONMENT !== "testing",
    },
  };
}

/** Config for reading sessions and for the default (30-day) login. */
export const options: SessionOptions = optionsWithLifetime(sessionLifetimeSeconds);

/** Session options for a login: 30 days by default, a year when the user asked to be remembered. */
export function sessionOptionsFor(remember: boolean): SessionOptions {
  return remember ? optionsWithLifetime(rememberedSessionLifetimeSeconds) : options;
}

/**
 * Unseals the session cookie without checking it against the database. For the
 * proxy (redirect decisions only, on every request) and for the routes that issue
 * or destroy sessions. Everything that trusts `session.user` uses {@link getSession}.
 */
export async function readSession(cookies: ReadonlyRequestCookies, sessionOptions?: SessionOptions): Promise<IronSession<LoginData>> {
  return getIronSession<LoginData>(cookies, sessionOptions ?? options);
}

/**
 * Whether a session issued with `sessionVersion` for `userId` is still honoured.
 * Memoized per request with React `cache()`, so a page render pays one lookup however
 * many fetchers read the session; route handlers pay one per call.
 */
const isSessionCurrent = cache(async (userId: string, sessionVersion: number): Promise<boolean> => {
  const user = await prisma.users.findUnique({ where: { id: userId }, select: { session_version: true } });
  return user !== null && user.session_version === sessionVersion;
});

/** How long the proxy trusts a verified cookie before asking the database again */
const proxyMemoMs = 60 * 1000;
type ProxyMemo = Map<string, { sessionVersion: number, until: number }>;
// On globalThis: the proxy is its own bundle, so a module-level map there would not be
// the one the logout route clears
const globalForSession = globalThis as unknown as { safProxySessionMemo?: ProxyMemo };
function proxyMemo(): ProxyMemo {
  globalForSession.safProxySessionMemo ??= new Map();
  return globalForSession.safProxySessionMemo;
}

/**
 * The proxy's version of {@link getSession}'s check, memoized across requests. The
 * proxy runs for every request, and a production page prefetches each create/edit
 * link it shows: without this, one page view cost one `session_version` lookup per
 * such link (the db-budget canary caught 4–8 extra statements per page). A verified
 * cookie is trusted for a minute; a revocation in this process clears the memo at
 * once ({@link forgetProxySession}), so "log out everywhere" still bites immediately.
 * Pages keep using the exact per-request check. Single-instance, like the API throttles.
 */
export async function isSessionCurrentForProxy(userId: string, sessionVersion: number): Promise<boolean> {
  const memo = proxyMemo();
  const known = memo.get(userId);
  if (known?.sessionVersion === sessionVersion && known.until > Date.now()) {
    return true;
  }
  const current = await isSessionCurrent(userId, sessionVersion);
  if (current) {
    memo.set(userId, { sessionVersion, until: Date.now() + proxyMemoMs });
  }
  else {
    memo.delete(userId);
  }
  return current;
}

/** Drops the proxy's memo of a user's cookie; called wherever `session_version` is bumped */
export function forgetProxySession(userId: string): void {
  proxyMemo().delete(userId);
}

/**
 * Reads login data from cookies and checks it against the database. The cookie is
 * stateless (iron-session), so "log out everywhere" works by bumping
 * `Users.session_version`: a session issued under an older version, or for a user
 * who no longer exists, reads as anonymous here. The stale cookie itself is left in
 * place because server components may not set cookies during render; the next
 * login or logout replaces it.
 */
export async function getSession(cookies: ReadonlyRequestCookies, sessionOptions?: SessionOptions): Promise<IronSession<LoginData>> {
  const session = await readSession(cookies, sessionOptions);
  if (session.user?.isLoggedIn && !(await isSessionCurrent(session.user.id, session.user.sessionVersion ?? 0))) {
    delete session.user;
  }
  return session;
}