import "server-only";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/functions/email";
import { isAllowedDomain, isValidDomain, orgDomainCandidates } from "@/functions/enrollment";

export type Enrollment = {
  /** The address's domain, or null if it doesn't parse */
  domain: string | null,
  /** Whether an account may be created for this address at all */
  allowed: boolean,
  /** The org a new account joins as MEMBER, if the domain (or a parent) is claimed by one */
  orgId: string | null,
};

/**
 * What signing up with `email` (normalized) would mean: whether the domain is on the
 * allowlist and which org, if any, owns it. Shared by password signup and login-link
 * redemption so the two can never drift apart.
 *
 * Orgs are curated, so nothing is auto-created here: users from unclaimed domains
 * get no org and can be invited into one later. The most specific matching org wins
 * ("stadshuset.goteborg.se" joins an org with domain "goteborg.se" only if nothing
 * claims the subdomain).
 */
export async function enrollmentFor(email: string): Promise<Enrollment> {
  const domain = emailDomain(email);
  if (!isValidDomain(domain) || !isAllowedDomain(domain)) {
    return { domain: isValidDomain(domain) ? domain : null, allowed: false, orgId: null };
  }

  const matchingOrgs = await prisma.orgs.findMany({
    where: { domain: { in: orgDomainCandidates(domain) } },
    select: { id: true, domain: true },
  });
  const org = matchingOrgs.sort((a, b) => (b.domain?.length ?? 0) - (a.domain?.length ?? 0)).at(0);

  return { domain, allowed: true, orgId: org?.id ?? null };
}
