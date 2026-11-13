import "server-only";
import Actions from "@/components/pages/sections/actions";
import RoadmapTree from "@/components/tables/roadmapTables/roadmapTree";
import { getActionSummaries } from "@/fetchers";
import { orgBannerPath } from "@/functions/orgBanner";
import { OrgView } from "@/functions/orgLanding";
import { seesOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { GeoAreaType } from "@/lib/prisma/generated";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { PublicTopLiked } from "./topLiked";
import ViewToggle from "./viewToggle";
import styles from "./orgLanding.module.css" with { type: "css" };
import type { OrgLandingProps } from "./types";

const loader = <Image src={'/loaders/3-dots-move.svg'} width={24} height={24} alt='' aria-live="polite" />;

/**
 * The org's public view: what visitors, users of other orgs and members without write
 * access get. Everything is fetched as `viewerContext`, so it only holds what that
 * viewer may see; for someone who also has the working view it is a preview of what a
 * visitor without a login gets.
 */
export default async function OrgPublicView({ org, viewerContext, entitled, iterations }: OrgLandingProps) {
  const t = await serveTea(["pages", "common"]);
  const isMember = seesOrg(viewerContext, org.id);
  const county = org.geoArea?.type === GeoAreaType.MUNICIPALITY && org.geoArea.parent?.type === GeoAreaType.COUNTY ? org.geoArea.parent : null;

  return <>
    {entitled ?
      <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between margin-top-100">
        <ViewToggle orgId={org.id} view={OrgView.Public} />
        <small className="color-gray" data-testid="org-preview-note">{t("pages:org_landing.view.preview_note")}</small>
      </div>
      : null}

    <section aria-label={t("pages:org_landing.organisation")}>
      {/* The org's banner over the brand colour, which also stands in while the org has none (and shows through a transparent one) */}
      <div className="rounded width-100 margin-bottom-100 margin-top-100 flex align-items-flex-end position-relative overflow-hidden" style={{ height: '350px', backgroundColor: 'var(--seagreen)' }} data-testid="org-hero">
        {org.bannerUpdatedAt ? <>
          {/* Unoptimized: the route sets its own cache headers per banner version */}
          <Image src={orgBannerPath(org.id, org.bannerUpdatedAt)} alt="" fill={true} unoptimized={true} priority={true} style={{ objectFit: 'cover' }} data-testid="org-banner" />
          {/* Keeps the heading readable over a light picture */}
          <div className="position-absolute width-100" style={{ inset: 0, background: 'linear-gradient(transparent 45%, rgba(0, 0, 0, .6))' }} aria-hidden="true" />
        </> : null}
        <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between padding-100 width-100 position-relative">
          <div>
            <h1 className="margin-block-25 color-purewhite" data-testid="home-title">{org.name}</h1>
            {org.geoArea ?
              <ul className={styles.tags} data-testid="org-tags">
                <li>
                  {org.geoArea.type === GeoAreaType.MUNICIPALITY
                    ? t("pages:org_landing.area_municipality", { area: org.geoArea.name })
                    : t("pages:org_landing.area", { area: org.geoArea.name })}
                </li>
                {county ? <li>{county.name}</li> : null}
              </ul>
              : null}
          </div>
          { // Any member may start a roadmap in the org
            isMember
              ? <Link href="/roadmap/create" className="button purewhite round block">{t("pages:home.create_roadmap")}</Link>
              : null}
        </div>
      </div>
    </section>

    <section className="margin-top-300" aria-labelledby="org-liked-title">
      <h2 id="org-liked-title" className="margin-top-0 margin-bottom-50 font-weight-600">{t("pages:org_landing.public.liked_title")}</h2>
      <Suspense key={org.id} fallback={loader}>
        <PublicTopLiked orgId={org.id} asVisitor={viewerContext === null} canOpenAreaOverview={isMember} />
      </Suspense>
    </section>

    <section className="margin-block-300" aria-labelledby="org-plans-title">
      <h2 id="org-plans-title" className="margin-top-0 margin-bottom-100 font-weight-600">{t("pages:org_landing.public.plans_title")}</h2>
      <Suspense key={org.id} fallback={loader}>
        <PublicPlans {...{ org, viewerContext, iterations }} />
      </Suspense>
    </section>
  </>;
}

/** The roadmaps and actions the viewer may see, or an explicit empty state; streamed, since the actions are */
async function PublicPlans({ org, viewerContext, iterations }: Pick<OrgLandingProps, "org" | "viewerContext" | "iterations">) {
  const [t, actions] = await Promise.all([
    serveTea(["pages", "common"]),
    getActionSummaries(org.id, { asVisitor: viewerContext === null }),
  ]);

  if (iterations.length === 0 && actions.length === 0) {
    return (
      <div className={styles.empty} data-testid="org-plans-empty">
        <strong>{t("pages:org_landing.public.plans_empty_title")}</strong>
        <span>{t("pages:org_landing.public.plans_empty", { org: org.name })}</span>
      </div>
    );
  }

  return <>
    {iterations.length > 0 ? <RoadmapTree accessContext={viewerContext} iterations={iterations} /> : null}
    {actions.length > 0 ?
      <div className="margin-top-200" data-testid="org-actions">
        <Actions actions={actions} canCreate={false} />
      </div>
      : null}
  </>;
}
