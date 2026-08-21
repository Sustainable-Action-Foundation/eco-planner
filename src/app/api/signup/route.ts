import type { NextRequest } from "next/server";
import { allowedDomains, orgDomainAliases } from "@/lib/allowedDomains";
import { OrgRole } from "@/lib/prisma/generated";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import mailClient, { type MailOptions } from "@/mailClient";
import getUserHash from "@/functions/getUserHash";
import { baseUrl } from "@/lib/baseUrl";
import serveTea from "@/lib/i18nServer";
import type { JSONValue } from "@/types";
import { isValidUsername, usernameMaxLength, usernameMinLength } from "@/functions/username";

export async function POST(request: NextRequest) {
  const t = await serveTea("email");

  const body = await (request.json() as Promise<JSONValue>);
  if (!body || typeof body !== "object" || Array.isArray(body) || !(typeof body.username === 'string') || !(typeof body.email === 'string') || !(typeof body.password === 'string')) {
    return Response.json({ message: 'Invalid body; username, email, and password are required' }, { status: 400 });
  }
  const { username, email, password } = body;
  const lowercaseEmail = email.toLowerCase();

  // Usernames appear in /user/[username] URLs, so restrict them to URL-safe characters
  if (!isValidUsername(username)) {
    return Response.json({ message: `Invalid username; use ${usernameMinLength}-${usernameMaxLength} characters: letters, digits, ".", "_" or "-"` },
      { status: 400 },
    );
  }

  // Check if email or username already exists; this is implicitly done by Prisma when creating a new user,
  // but we want to return a more specific error message
  const usernameExists = await prisma.users.findUnique({
    where: {
      username: username,
    },
  });

  if (usernameExists) {
    return Response.json({ message: 'Username "' + username + '" is already taken' },
      { status: 400 },
    );
  }

  const emailExists = await prisma.users.findUnique({
    where: {
      email: lowercaseEmail,
    },
  });

  if (emailExists) {
    return Response.json({ message: 'Email "' + lowercaseEmail + '" is already in use' },
      { status: 400 },
    );
  }

  // Check if email belongs to an allowed domain
  // Get the part after last '@' to support emails like `"john@doe"@example.com`, and trim any whitespace or trailing '>' character (e.g. if the email is in the format `John Doe <john.doe@example.com>`)
  const domain = lowercaseEmail.split('@').pop()?.trim().replace(/>$/, '').trim();
  /** A regex matching domain names according to RFC 1035 and RFC 1123 */
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(domain ?? '')) {
    return Response.json({ message: `Failed to parse domain '${domain}'.` },
      { status: 400 },
    );
  }

  // NOTE: Guests are disabled until further notice. When they return, pending
  // guest invites both bypass the domain allowlist (the invitation is the
  // vetting) and are consumed into GUEST memberships at creation below.
  // const pendingInvites = await prisma.guestInvites.findMany({
  //   where: { email: lowercaseEmail },
  //   select: { org_id: true },
  // });

  // Check if the domain ends with any of the allowed domains (to allow subdomains)
  if (!allowedDomains.some((allowedDomain) => (domain === allowedDomain) || (domain ?? '').endsWith('.' + allowedDomain))
    /* && pendingInvites.length === 0 */) {
    return Response.json({ message: `Email domain '${domain}' is not allowed` },
      { status: 400 },
    );
  }

  // Hash password
  const saltRounds: number = 11;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // If mailClient does not verify, don't try to create the user since something on the server is misconfigured. If only the sendVerificationEmail function fails, the user can try requesting a new verification email later.
  try {
    await mailClient.verify();
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: 'Problem connecting to email service; User not created since server is misconfigured. Please try again later' },
      { status: 500 },
    );
  }

  // Find the org owning this email domain, if any. Matches the exact domain or a parent domain
  // (e.g. "stadshuset.goteborg.se" joins an org with domain "goteborg.se"); prefers the most specific match.
  // Orgs are curated, so unlike the old per-domain user groups nothing is auto-created here:
  // users from unclaimed domains sign up without an org and can be invited into one later.
  // Aliased domains (e.g. sustainable-action.ngo) enroll into their canonical domain's org
  const domainCandidates = (domain ?? '').split('.').map((_, i, parts) => parts.slice(i).join('.'))
    .map(candidate => orgDomainAliases[candidate] ?? candidate);
  const matchingOrgs = await prisma.orgs.findMany({
    where: { domain: { in: domainCandidates } },
    select: { id: true, domain: true },
  });
  const org = matchingOrgs.sort((a, b) => (b.domain?.length ?? 0) - (a.domain?.length ?? 0)).at(0);

  // NOTE: Guests are disabled until further notice. When they return, signup
  // consumes any pending invites into GUEST memberships:
  // const invitedOrgIds = [...new Set(pendingInvites.map(invite => invite.org_id))].filter(orgId => orgId !== org?.id);
  // ... and inside the creation below:
  //   memberships: { create: [ ...member entry..., ...invitedOrgIds.map(orgId => ({ org: { connect: { id: orgId } }, role: OrgRole.GUEST })) ] }
  //   await tx.guestInvites.deleteMany({ where: { email: lowercaseEmail } });

  // Create user
  try {
    await prisma.users.create({
      data: {
        username: username,
        email: lowercaseEmail,
        password_hash: hashedPassword,
        ...(org ? {
          memberships: {
            create: {
              org: { connect: { id: org.id } },
              role: OrgRole.MEMBER,
            },
          },
        } : {}),
      },
    });
  }
  catch (err) {
    console.error(err);
    return Response.json({ message: 'Error creating user' },
      { status: 500 },
    );
  }

  // Send verification email. This is done after creating the user to avoid sending an email if the user creation fails.
  // If the sendMail function fails, the user is still created and can try to verify their email later.
  try {
    const userHash = await getUserHash(lowercaseEmail);
    if (!userHash) {
      throw new Error('User not found');
    }

    const mailContent: MailOptions = {
      from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
      to: lowercaseEmail,
      subject: t("email:signup.subject"),
      text: t("email:signup.body", { baseUrl: baseUrl, email: lowercaseEmail, userHash: userHash }),
    };

    await mailClient.sendMail(mailContent).catch((err: unknown) => {
      console.error(err);
      throw new Error('Error sending verification email');
    });
  } catch {
    return Response.json({ message: 'User created, but failed to send verification email' },
      {
        status: 200,
        headers: { 'Location': '/verify' },
      },
    );
  }

  return Response.json({ message: 'User created' },
    {
      status: 200,
      headers: { 'Location': '/verify' },
    },
  );
}