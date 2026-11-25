import "server-only";
import { OrgView, orgLandingPath } from "@/functions/orgLanding";
import serveTea from "@/lib/i18nServer";
import Link from "next/link";

/** Switches between the org's public and working view; only rendered for those entitled to both */
export default async function ViewToggle({ orgId, view }: { orgId: string, view: OrgView }) {
  const t = await serveTea("pages");
  const options = [
    { view: OrgView.Working, label: t("pages:org_landing.view.working") },
    { view: OrgView.Public, label: t("pages:org_landing.view.public") },
  ];

  return (
    <nav className="flex gap-50 flex-wrap-wrap" aria-label={t("pages:org_landing.view.label")} data-testid="org-view-toggle">
      {options.map(option => (
        <Link
          key={option.view}
          href={orgLandingPath(orgId, { view: option.view })}
          aria-current={option.view === view ? "page" : undefined}
          data-view={option.view}
          className={`button round smooth font-size-14px${option.view === view ? ' seagreen color-purewhite font-weight-500' : ''}`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
