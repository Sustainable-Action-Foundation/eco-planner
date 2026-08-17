// NOTE: Guest invites are DISABLED until further notice. All endpoints return
// 404. The full implementation is preserved, line-commented, at the bottom of
// this file; restore it (and the other "guests disabled" sites, grep for
// "disabled until further notice") to bring the feature back.
import serveTea from "@/lib/i18nServer";
import type { NextRequest } from "next/server";

async function disabled() {
  const t = await serveTea("api");
  return Response.json({ message: t('api:guestInvite.invalid') },
    { status: 404 },
  );
}

export async function POST(_request: NextRequest) { return disabled(); }
export async function PUT(_request: NextRequest) { return disabled(); }
export async function DELETE(_request: NextRequest) { return disabled(); }

// ===========================================================================
// Original implementation (disabled until further notice)
// ===========================================================================
// import { getAccessContextById } from "@/fetchers/getUserAccessContext";
// import { baseUrl } from "@/lib/baseUrl";
// import serveTea from "@/lib/i18nServer";
// import mailClient from "@/mailClient";
// import { prisma } from "@/lib/prisma";
// import { OrgRole } from "@/lib/prisma/generated";
// import { getSession } from "@/lib/session";
// import type { UserAccessContext } from "@/types";
// import { cookies } from "next/headers";
// import type { NextRequest } from "next/server";
// import type { MailOptions } from "@/mailClient";
//
// // Guest invitations: org managers invite an email address; the invitee gets a
// // mail with a link to /invite/<token>. Accepting (or signing up with the
// // invited email, see the signup route) consumes the invite into a GUEST
// // membership. The token is the capability; invites are single-use and live
// // only while pending.
//
// function managesOrg(accessContext: UserAccessContext, orgId: string): boolean {
//   return accessContext.isSuperAdmin
//     || accessContext.memberships.some(membership => membership.orgId === orgId && membership.role === OrgRole.MANAGER);
// }
//
// /** Sends (or re-sends, with a fresh token) a guest invite for an org the requester manages */
// export async function POST(request: NextRequest) {
//   const [session, body, t] = await Promise.all([
//     getSession(await cookies()),
//     request.json() as Promise<{ orgId?: string, email?: string }>,
//     serveTea(["api", "email"]),
//   ]);
//
//   if (!session.user?.id) {
//     return Response.json({ message: t('api:common.unauthorized') },
//       { status: 401, headers: { 'Location': '/login' } },
//     );
//   }
//   const accessContext = await getAccessContextById(session.user.id);
//   if (!accessContext) {
//     return Response.json({ message: t('api:common.unauthorized') },
//       { status: 401, headers: { 'Location': '/login' } },
//     );
//   }
//
//   const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
//   if (!body.orgId || typeof body.orgId !== 'string' || !email) {
//     return Response.json({ message: t('api:common.missing_input') },
//       { status: 400 },
//     );
//   }
//   // Light shape check; the real validation is that the invite mail arrives
//   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//     return Response.json({ message: t('api:guestInvite.invalid_email') },
//       { status: 400 },
//     );
//   }
//
//   if (!managesOrg(accessContext, body.orgId)) {
//     return Response.json({ message: t('api:group.manager_only') },
//       { status: 403 },
//     );
//   }
//
//   const org = await prisma.orgs.findUnique({ where: { id: body.orgId }, select: { id: true, name: true } });
//   if (!org) {
//     return Response.json({ message: t('api:common.missing_input') },
//       { status: 400 },
//     );
//   }
//
//   // Someone who's already in the org needs no invite
//   const existingMembership = await prisma.orgMemberships.findFirst({
//     where: { org_id: org.id, user: { email } },
//     select: { id: true },
//   });
//   if (existingMembership) {
//     return Response.json({ message: t('api:guestInvite.already_member') },
//       { status: 400 },
//     );
//   }
//
//   const inviterId = session.user.id;
//   let invite;
//   try {
//     // Re-inviting replaces any pending invite (and rotates the token)
//     invite = await prisma.$transaction(async (tx) => {
//       await tx.guestInvites.deleteMany({ where: { org_id: org.id, email } });
//       return tx.guestInvites.create({
//         data: {
//           email,
//           org: { connect: { id: org.id } },
//           invited_by: { connect: { id: inviterId } },
//         },
//       });
//     });
//   }
//   catch (error) {
//     console.error("Error creating guest invite", { error });
//     return Response.json({ message: t('api:common.server_error') },
//       { status: 500 },
//     );
//   }
//
//   const mailContent: MailOptions = {
//     from: t("email:common.from", { emailServer: process.env.MAIL_USER }),
//     to: email,
//     subject: t("email:invite.subject", { orgName: org.name }),
//     text: t("email:invite.body", { orgName: org.name, baseUrl: baseUrl, token: invite.token }),
//   };
//   try {
//     await mailClient.sendMail(mailContent);
//   }
//   catch (err) {
//     // Keep the invite: it shows up in the pending list, where the manager can revoke or re-send it
//     console.error("Error sending guest invite email", { err });
//     return Response.json({ message: t('api:guestInvite.send_failed') },
//       { status: 500 },
//     );
//   }
//
//   return Response.json({ message: t('api:guestInvite.sent') },
//     { status: 201 },
//   );
// }
//
// /** Accepts an invite: the signed-in user with the invited email joins the org as a GUEST */
// export async function PUT(request: NextRequest) {
//   const [session, body, t] = await Promise.all([
//     getSession(await cookies()),
//     request.json() as Promise<{ token?: string }>,
//     serveTea("api"),
//   ]);
//
//   if (!session.user?.id) {
//     return Response.json({ message: t('api:common.unauthorized') },
//       { status: 401, headers: { 'Location': '/login' } },
//     );
//   }
//
//   if (!body.token || typeof body.token !== 'string') {
//     return Response.json({ message: t('api:common.missing_input') },
//       { status: 400 },
//     );
//   }
//
//   const invite = await prisma.guestInvites.findUnique({
//     where: { token: body.token },
//     select: { token: true, email: true, org_id: true },
//   });
//   if (!invite) {
//     return Response.json({ message: t('api:guestInvite.invalid') },
//       { status: 404 },
//     );
//   }
//
//   const user = await prisma.users.findUnique({
//     where: { id: session.user.id },
//     select: { id: true, email: true },
//   });
//   // The invite is bound to the email it was sent to
//   if (user?.email.toLowerCase() !== invite.email) {
//     return Response.json({ message: t('api:guestInvite.email_mismatch') },
//       { status: 403 },
//     );
//   }
//
//   try {
//     await prisma.$transaction(async (tx) => {
//       const alreadyMember = await tx.orgMemberships.findFirst({
//         where: { org_id: invite.org_id, user_id: user.id },
//         select: { id: true },
//       });
//       if (!alreadyMember) {
//         await tx.orgMemberships.create({
//           data: { org_id: invite.org_id, user_id: user.id, role: OrgRole.GUEST },
//         });
//       }
//       await tx.guestInvites.delete({ where: { token: invite.token } });
//     });
//   }
//   catch (error) {
//     console.error("Error accepting guest invite", { error });
//     return Response.json({ message: t('api:common.server_error') },
//       { status: 500 },
//     );
//   }
//
//   return Response.json({ message: t('api:guestInvite.accepted') },
//     { status: 200, headers: { 'Location': '/' } },
//   );
// }
//
// /** Revokes a pending invite in an org the requester manages */
// export async function DELETE(request: NextRequest) {
//   const [session, body, t] = await Promise.all([
//     getSession(await cookies()),
//     request.json() as Promise<{ token?: string }>,
//     serveTea("api"),
//   ]);
//
//   if (!session.user?.id) {
//     return Response.json({ message: t('api:common.unauthorized') },
//       { status: 401, headers: { 'Location': '/login' } },
//     );
//   }
//   const accessContext = await getAccessContextById(session.user.id);
//   if (!accessContext) {
//     return Response.json({ message: t('api:common.unauthorized') },
//       { status: 401, headers: { 'Location': '/login' } },
//     );
//   }
//
//   if (!body.token || typeof body.token !== 'string') {
//     return Response.json({ message: t('api:common.missing_input') },
//       { status: 400 },
//     );
//   }
//
//   const invite = await prisma.guestInvites.findUnique({
//     where: { token: body.token },
//     select: { token: true, org_id: true },
//   });
//   if (!invite || !managesOrg(accessContext, invite.org_id)) {
//     return Response.json({ message: t('api:guestInvite.invalid') },
//       { status: 404 },
//     );
//   }
//
//   try {
//     await prisma.guestInvites.delete({ where: { token: invite.token } });
//   }
//   catch (error) {
//     console.error("Error revoking guest invite", { error });
//     return Response.json({ message: t('api:common.server_error') },
//       { status: 500 },
//     );
//   }
//
//   return Response.json({ message: t('api:guestInvite.revoked') },
//     { status: 200 },
//   );
// }
