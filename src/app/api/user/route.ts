import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { normalizeName, nameMaxLength } from "@/functions/personName";
import type { JSONValue } from "@/types";

/**
 * The signed-in user's own account. PATCH sets the first and last name, asked for
 * at first login (/welcome) and editable from the profile page. Both are required
 * together: a half-filled name would read worse than the username fallback.
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession(await cookies());
  if (!session.user?.isLoggedIn) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await (request.json() as Promise<JSONValue>).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "Invalid body" }, { status: 400 });
  }
  const firstName = normalizeName(body.firstName);
  const lastName = normalizeName(body.lastName);
  if (!firstName || !lastName) {
    return Response.json({ message: `firstName and lastName are required, each 1-${nameMaxLength} characters` }, { status: 400 });
  }

  await prisma.users.update({
    where: { id: session.user.id },
    data: { first_name: firstName, last_name: lastName },
  });
  // Profile pages and author bylines are cached by user
  revalidateTag("user", { expire: 0 });

  return Response.json({ message: "Name updated", firstName, lastName }, { status: 200 });
}
