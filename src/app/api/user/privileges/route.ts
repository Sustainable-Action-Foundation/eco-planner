import type { NextRequest } from "next/server";
import { readJson } from "@/functions/readJson";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession, readSession, sessionOptionsFor } from "@/lib/session";

/**
 * The signed-in super admin's privileges in this browser session. POST
 * `{ superAdmin: false }` suspends their super-admin powers, so they see and may do
 * exactly what their org memberships allow (getSession hands out the effective flag);
 * `{ superAdmin: true }` restores them. Stored in the session cookie, not the
 * database: other browsers are unaffected and a new login starts privileged.
 *
 * 401 without a valid session, 403 unless the user is a super admin in the database.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const checked = await getSession(cookieStore);
  if (!checked.user?.isLoggedIn) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.superAdmin !== "boolean") {
    return Response.json({ message: "Invalid body; superAdmin (boolean) is required" }, { status: 400 });
  }

  // The database decides, not the cookie: a demoted admin's old cookie cannot re-enable anything
  const user = await prisma.users.findUnique({ where: { id: checked.user.id }, select: { is_super_admin: true } });
  if (!user?.is_super_admin) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  // Written through the raw session (getSession's copy carries derived values), with the
  // lifetime the login was made with
  const session = await readSession(cookieStore, sessionOptionsFor(checked.user.remember === true));
  if (!session.user) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  session.user.isSuperAdmin = true;
  if (body.superAdmin) {
    delete session.user.superAdminSuspended;
  }
  else {
    session.user.superAdminSuspended = true;
  }
  await session.save();

  return Response.json({ message: body.superAdmin ? "Super admin powers restored" : "Super admin powers suspended", superAdmin: body.superAdmin }, { status: 200 });
}
