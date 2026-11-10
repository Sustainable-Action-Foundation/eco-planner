import { allowedDomains, orgDomainAliases } from "@/lib/allowedDomains";

/** A regex matching domain names according to RFC 1035 and RFC 1123 */
const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** Whether `domain` (lowercased) parses as a domain name at all. */
export function isValidDomain(domain: string | null | undefined): domain is string {
  return domainRegex.test(domain ?? "");
}

/**
 * Whether accounts may be created for addresses on `domain`: it must equal, or be a
 * subdomain of, an entry in the allowlist (`src/lib/allowedDomains.ts`).
 */
export function isAllowedDomain(domain: string): boolean {
  return allowedDomains.some(allowed => domain === allowed || domain.endsWith("." + allowed));
}

/**
 * The org domains an address on `domain` may enroll into, most specific first:
 * the domain itself and each parent (e.g. "stadshuset.goteborg.se" → "goteborg.se" →
 * "se"), with aliased domains mapped to their canonical one (e.g. sustainable-action.ngo).
 */
export function orgDomainCandidates(domain: string): string[] {
  return domain.split(".")
    .map((_, i, parts) => parts.slice(i).join("."))
    .map(candidate => orgDomainAliases[candidate] ?? candidate);
}

/**
 * Parses SUPER_ADMIN_DOMAINS (comma-separated, lowercased): addresses on these domains
 * get super admin on account creation. Meant for staging, where anyone from the
 * foundation should be able to log in and see everything; production leaves it unset.
 */
export function superAdminDomains(raw: string | undefined = process.env.SUPER_ADMIN_DOMAINS): string[] {
  return (raw ?? "").split(",").map(d => d.trim().toLowerCase()).filter(isValidDomain);
}

/** Whether a new account on `domain` is created as a super admin, see superAdminDomains. */
export function isSuperAdminDomain(domain: string, domains: string[] = superAdminDomains()): boolean {
  return domains.some(d => domain === d || domain.endsWith("." + d));
}
