import "server-only";
import { prisma } from "@/lib/prisma";

export type GuestInvite = { token: string, email: string, orgName: string };

/**
 * Looks up a pending guest invite for the invite landing page. Knowing the
 * token IS the authorization (it comes from the invite email), so there is no
 * session check here. Uncached: invites are single-use and short-lived.
 */
export async function getGuestInvite(token: string): Promise<GuestInvite | null> {
  try {
    const invite = await prisma.guestInvites.findUnique({
      where: { token },
      select: { token: true, email: true, org: { select: { name: true } } },
    });
    if (!invite) {
      return null;
    }
    return { token: invite.token, email: invite.email, orgName: invite.org.name };
  }
  catch (err) {
    console.error("Error fetching guest invite", { err });
    return null;
  }
}
