import { after, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, sessionOptionsFor } from "@/lib/session";
import { consumeToken } from "@/lib/rateLimit";
import { hashToken, loginTokenTtlMs, looksLikeEmail, mintToken } from "@/lib/authToken";
import { enrollmentFor } from "@/lib/enrollment";
import { normalizeEmail } from "@/functions/email";
import { deriveUsername, usernameKey } from "@/functions/username";
import { safeRedirectPath } from "@/functions/safeRedirectPath";
import mailClient, { type MailOptions } from "@/mailClient";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import { OrgRole } from "@/lib/prisma/generated";
import type { JSONValue } from "@/types";

/*
 * Passwordless login: POST mails a one-time link, PATCH redeems it.
 *
 * The POST always answers the same way and does its real work after the response
 * (`after()`), so neither the text nor the timing reveals whether an address has an
 * account. The link carries the token in the URL fragment (`/login/link#t=…`), which
 * browsers never send to the server, so it stays out of access logs and referrers,
 * and link-preview bots that fetch the page consume nothing: only the explicit PATCH does.
 */

/** Per address: a burst of 3, then about one link per 5 minutes */
const EMAIL_BUDGET = { capacity: 3, refillPerSecond: 1 / 300 } as const;
/** Per client IP (first hop of X-Forwarded-For): a burst of 10, then about one per minute */
const IP_BUDGET = { capacity: 10, refillPerSecond: 1 / 60 } as const;

const genericMessage = "If this address can sign in, a login link has been sent to it";

function generic() {
  return Response.json({ message: genericMessage }, { status: 200 });
}

function invalidLink() {
  return Response.json({ message: "The login link is invalid or has expired" }, { status: 400 });
}

/** Requests a login link for an address. */
export async function POST(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.email !== "string") {
    return Response.json({ message: "Invalid body; email is required" }, { status: 400 });
  }
  const email = normalizeEmail(body.email);
  if (!looksLikeEmail(email)) {
    // Says nothing about accounts, only about the string
    return Response.json({ message: "Invalid email address" }, { status: 400 });
  }
  const remember = body.remember === true;
  const redirect = typeof body.from === "string" ? safeRedirectPath(body.from) : "/";

  // Throttle silently: an over-budget request gets the same answer and sends nothing,
  // so the throttle itself can't be used to tell real addresses from fake ones.
  // Next fills X-Forwarded-For from the socket when the client sends none, so behind the
  // TLS proxy the first hop is whatever the proxy puts there (verify it overwrites a
  // client-supplied header; otherwise this bucket is bypassable and only the per-address one holds).
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!consumeToken(`login-link:email:${email}`, EMAIL_BUDGET)) {
    return generic();
  }
  if (clientIp && !consumeToken(`login-link:ip:${clientIp}`, IP_BUDGET)) {
    return generic();
  }

  // The requester's locale decides the mail language. The server i18n instance is shared and
  // follows the latest request, so both mails are rendered now, not inside after(), where a
  // concurrent request may have switched the language. Minting needs no database, so the
  // link can be rendered up front too; only the lookups, the row and the send are deferred.
  const t = await serveTea("email");
  const { token, hash } = mintToken();
  const link = `${baseUrl}/login/link#t=${token}`;
  const from = t("email:common.from", { emailServer: process.env.MAIL_USER });
  const mails: Record<"login" | "welcome", MailOptions> = {
    login: { from, to: email, subject: t("email:login.subject"), text: t("email:login.body", { link }) },
    welcome: { from, to: email, subject: t("email:welcome.subject"), text: t("email:welcome.body", { link, email }) },
  };

  after(async () => {
    try {
      const user = await prisma.users.findUnique({ where: { email }, select: { id: true } });
      let template: "login" | "welcome";
      if (user) {
        template = "login";
      }
      else if ((await enrollmentFor(email)).allowed) {
        // The account is created when the link is redeemed, never here: a typo or a bot never creates a row
        template = "welcome";
      }
      else {
        return;
      }

      // One pending link per address; a new request replaces the old one
      await prisma.$transaction([
        prisma.loginTokens.deleteMany({ where: { email } }),
        prisma.loginTokens.create({
          data: { token_hash: hash, email, expires_at: new Date(Date.now() + loginTokenTtlMs), remember, redirect },
        }),
      ]);

      await mailClient.sendMail(mails[template]);
    }
    catch (err) {
      console.error("Failed to send login link:", err);
    }
  });

  return generic();
}

/** Redeems a login link: starts a session, creating the account on first login. */
export async function PATCH(request: NextRequest) {
  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.token !== "string" || !body.token) {
    return Response.json({ message: "Invalid body; token is required" }, { status: 400 });
  }
  const tokenHash = hashToken(body.token);

  const row = await prisma.loginTokens.findUnique({ where: { token_hash: tokenHash } });
  if (!row) {
    return invalidLink();
  }
  // Single use: the delete is the claim. Of two concurrent redemptions only one deletes a row.
  const { count } = await prisma.loginTokens.deleteMany({ where: { token_hash: tokenHash, expires_at: { gt: new Date() } } });
  if (count !== 1) {
    // Expired (or raced): drop it either way
    await prisma.loginTokens.deleteMany({ where: { token_hash: tokenHash } }).catch(() => null);
    return invalidLink();
  }
  const { email, remember, redirect } = row;

  let user = await prisma.users.findUnique({
    where: { email },
    select: { id: true, username: true, is_super_admin: true, is_verified: true },
  });

  if (!user) {
    // First login creates the account. The allowlist is checked again: it may have changed since the request
    const enrollment = await enrollmentFor(email);
    if (!enrollment.allowed) {
      return invalidLink();
    }
    const username = await freeUsername(deriveUsername(email));
    user = await prisma.users.create({
      data: {
        username,
        username_lower: usernameKey(username),
        email,
        password_hash: null,
        is_verified: true,
        ...(enrollment.orgId ? {
          memberships: { create: { org: { connect: { id: enrollment.orgId } }, role: OrgRole.MEMBER } },
        } : {}),
      },
      select: { id: true, username: true, is_super_admin: true, is_verified: true },
    });
  }
  else if (!user.is_verified) {
    // Opening the link proves the address; no separate verification step needed
    await prisma.users.update({ where: { id: user.id }, data: { is_verified: true } });
  }

  // Replaces any existing session (switching accounts through a link is fine)
  const session = await getSession(await cookies(), sessionOptionsFor(remember));
  session.user = {
    id: user.id,
    username: user.username,
    isLoggedIn: true,
    isSuperAdmin: user.is_super_admin,
  };
  await session.save();

  const target = safeRedirectPath(redirect);
  return Response.json({ message: "Login successful", redirect: target }, { status: 200, headers: { Location: target } });
}

/** `base`, or `base-2`, `base-3`, … until one is not taken (case-insensitively). */
async function freeUsername(base: string): Promise<string> {
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const taken = await prisma.users.findUnique({ where: { username_lower: usernameKey(candidate) }, select: { id: true } });
    if (!taken) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}
