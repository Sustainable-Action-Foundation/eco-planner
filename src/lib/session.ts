import type { IronSession, SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import type { LoginData } from "@/types";


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
    cookieName: "eco_planner",
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
 * Reads login data from cookies
 */
export async function getSession(cookies: ReadonlyRequestCookies, sessionOptions?: SessionOptions): Promise<IronSession<LoginData>> {
  return getIronSession<LoginData>(cookies, sessionOptions ?? options);
};