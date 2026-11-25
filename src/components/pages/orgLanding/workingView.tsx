import "server-only";
import Actions from "@/components/pages/sections/actions";
import CuratedHistoricalData from "@/components/pages/sections/historicalData";
import LikedGoals from "@/components/pages/sections/likedGoals";
import NationalGoals from "@/components/pages/sections/nationalGoals";
import ShowHiddenToggle from "@/components/form/filters/showHiddenToggle";
import RoadmapTree from "@/components/tables/roadmapTables/roadmapTree";
import { getActionSummaries } from "@/fetchers";
import { OrgTab, OrgView, orgLandingPath } from "@/functions/orgLanding";
import { orgTypeLabel } from "@/functions/orgTypeLabel";
import accessChecker, { hasEditAccess, managesOrg } from "@/lib/accessChecker";
import serveTea from "@/lib/i18nServer";
import { GeoAreaType } from "@/lib/prisma/generated";
import type { Roadmap, UserAccessContext } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AreaOrgs, CommentsTab, Gaps, KeyNumbers, MembersTab, RecentActivity, TabCount } from "./overview";
import ProcessBar from "./processBar";
import { WorkingTopLiked } from "./topLiked";
import ViewToggle from "./viewToggle";
import styles from "./orgLanding.module.css" with { type: "css" };
import type { WorkingViewProps } from "./types";

const loader = <Image src={'/loaders/3-dots-move.svg'} width={24} height={24} alt='' aria-live="polite" />;

/**
 * The org's working view, for those who can write something in it: a header with
 * what the viewer is here, section tabs (`?tab=`, rendered on the server) and the
 * chosen section. The viewer reads everything they may read; what they can't edit
 * carries the read-only badge and no edit controls.
 */
export default async function OrgWorkingView(props: WorkingViewProps) {
  const { org, accessContext, tab, tabs } = props;
  const t = await serveTea(["pages", "common"]);
  const manages = managesOrg(accessContext, org.id);

  const tabLabels: Record<OrgTab, string> = {
    [OrgTab.Overview]: t("pages:org_landing.tabs.overview"),
    [OrgTab.Roadmaps]: t("pages:org_landing.tabs.roadmaps"),
    [OrgTab.Actions]: t("pages:org_landing.tabs.actions"),
    [OrgTab.Liked]: t("pages:org_landing.tabs.liked"),
    [OrgTab.Data]: t("pages:org_landing.tabs.data"),
    [OrgTab.Comments]: t("pages:org_landing.tabs.comments"),
    [OrgTab.Members]: t("pages:org_landing.tabs.members"),
  };

  return <>
    <div className="margin-top-100">
      <ViewToggle orgId={org.id} view={OrgView.Working} />
    </div>

    <section className="margin-top-100 margin-bottom-100" aria-label={t("pages:org_landing.organisation")} data-testid="org-working-header">
      <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between">
        <div>
          <p className="margin-0 color-gray font-size-14px" data-testid="org-meta">
            {[
              org.orgType ? orgTypeLabel(t, org.orgType) : null,
              org.geoArea
                ? (org.geoArea.type === GeoAreaType.MUNICIPALITY
                  ? t("pages:org_landing.area_municipality", { area: org.geoArea.name })
                  : t("pages:org_landing.area", { area: org.geoArea.name }))
                : null,
              accessContext?.isSuperAdmin
                ? t("pages:org_landing.role.super_admin")
                : manages ? t("pages:org_landing.role.manager") : t("pages:org_landing.role.writer"),
            ].filter(Boolean).join(" · ")}
          </p>
          <h1 className="margin-block-25" data-testid="home-title">{org.name}</h1>
        </div>
        <div className="flex gap-50 flex-wrap-wrap align-items-center">
          <Link href="/roadmap/create" className="button seagreen color-purewhite round block">{t("pages:home.create_roadmap")}</Link>
          { // Managers also administer the org's profile, members and groups
            manages
              ? <Link href={`/org/${org.id}/groups`} className="button round block" data-testid="org-manage-link">{t("pages:org_groups.manage_groups")}</Link>
              : null}
        </div>
      </div>
    </section>

    <nav className={styles.tabs} aria-label={t("pages:org_landing.tabs.label")} data-testid="org-tabs">
      {tabs.map(item => (
        <Link key={item} href={orgLandingPath(org.id, { tab: item })} aria-current={item === tab ? "page" : undefined} data-tab={item}>
          {tabLabels[item]}
          {item === OrgTab.Liked || item === OrgTab.Members ? <Suspense key={org.id} fallback={null}><TabCount orgId={org.id} tab={item} /></Suspense> : null}
        </Link>
      ))}
    </nav>

    <div className="margin-top-200 margin-bottom-300" data-testid="org-tab-panel" data-tab={tab}>
      <TabPanel {...props} />
    </div>
  </>;
}

async function TabPanel(props: WorkingViewProps) {
  const { org, accessContext, tab, iterations, searchParams, likeScope, copyTargets, allRoadmaps } = props;
  const t = await serveTea(["pages", "common"]);

  if (tab === OrgTab.Roadmaps) {
    return (
      <section aria-labelledby="org-roadmaps-title">
        <div className="flex gap-100 flex-wrap-wrap align-items-center justify-content-space-between margin-bottom-100">
          <h2 id="org-roadmaps-title" className="margin-0 font-weight-600">{t("pages:home.title")}</h2>
          <ShowHiddenToggle />
        </div>
        <RoadmapTree accessContext={accessContext} iterations={iterations} markReadOnly={true} />
      </section>
    );
  }
  if (tab === OrgTab.Actions) {
    return (
      <section>
        <Suspense key={org.id} fallback={loader}>
          <OrgActions orgId={org.id} accessContext={accessContext} roadmaps={allRoadmaps} />
        </Suspense>
      </section>
    );
  }
  if (tab === OrgTab.Liked) {
    // The goals the org's members have liked, ranked; copies from the list go into the org's roadmaps
    return (
      <section>
        <Suspense key={`${org.id}:${likeScope}`} fallback={loader}>
          <LikedGoals orgId={org.id} scope={likeScope} searchParams={searchParams} canCreateGoals={copyTargets.length > 0} />
        </Suspense>
      </section>
    );
  }
  if (tab === OrgTab.Data) {
    // National goals the org can copy and the curated statistics, both localized to the org's area
    const geoArea = org.geoArea;
    if (!geoArea) {
      return (
        <div className={styles.empty} data-testid="org-data-no-area">
          <strong>{t("pages:org_landing.working.no_area_title")}</strong>
          <span>{t("pages:org_landing.working.no_area")}</span>
          {managesOrg(accessContext, org.id) ? <Link href={`/org/${org.id}/groups`}>{t("pages:org_landing.working.set_area")}</Link> : null}
        </div>
      );
    }
    return <>
      <section className="margin-bottom-300">
        {/* The sections fetch from external statistics APIs; don't block the rest of the page on a cold cache */}
        <Suspense key={org.id} fallback={loader}>
          <NationalGoals orgId={org.id} geoArea={geoArea} iterations={copyTargets} />
        </Suspense>
      </section>
      <section>
        <Suspense key={org.id} fallback={loader}>
          <CuratedHistoricalData orgId={org.id} geoArea={geoArea} />
        </Suspense>
      </section>
    </>;
  }
  if (tab === OrgTab.Comments) {
    return <Suspense key={org.id} fallback={loader}><CommentsTab {...props} /></Suspense>;
  }
  if (tab === OrgTab.Members) {
    return <Suspense key={org.id} fallback={loader}><MembersTab {...props} /></Suspense>;
  }

  return <>
    <section className={`${styles.card} margin-bottom-100`} aria-labelledby="org-process-title">
      <Suspense key={org.id} fallback={loader}>
        <ProcessBar orgId={org.id} areaName={org.geoArea?.name ?? null} focusStep={org.focusStep} focusPeriod={org.focusPeriod} asVisitor={false} working={true} />
      </Suspense>
    </section>

    <div className={styles.columns}>
      <div className="flex flex-direction-column gap-100">
        <section className={styles.card} aria-labelledby="org-gaps-title">
          <Suspense key={org.id} fallback={loader}>
            <Gaps {...props} />
          </Suspense>
        </section>
        <section className={styles.card} aria-labelledby="org-top-liked-title">
          <Suspense key={`${org.id}:${likeScope}`} fallback={loader}>
            <WorkingTopLiked orgId={org.id} scope={likeScope} />
          </Suspense>
        </section>
      </div>
      <aside className="flex flex-direction-column gap-100">
        <section className={styles.card} aria-labelledby="org-numbers-title">
          <Suspense key={org.id} fallback={loader}>
            <KeyNumbers {...props} />
          </Suspense>
        </section>
        <section className={styles.card} aria-labelledby="org-activity-title">
          <Suspense key={org.id} fallback={loader}>
            <RecentActivity {...props} />
          </Suspense>
        </section>
        <Suspense key={org.id} fallback={null}>
          <AreaOrgs org={org} asVisitor={false} working={true} />
        </Suspense>
      </aside>
    </div>
  </>;
}

/**
 * The org's actions, streamed in their own boundary so the shell never waits on them.
 * An action is edited through its roadmap, or by the org's managers when it has none.
 */
async function OrgActions({ orgId, accessContext, roadmaps }: { orgId: string, accessContext: UserAccessContext | null, roadmaps: Roadmap[] }) {
  const actions = await getActionSummaries(orgId);
  const writableIterationIds = new Set(roadmaps
    .filter(roadmap => hasEditAccess(accessChecker(roadmap, accessContext)))
    .flatMap(roadmap => roadmap.iterations.map(iteration => iteration.id)));
  const readOnlyIds = actions
    .filter(action => action.roadmap_iteration_id ? !writableIterationIds.has(action.roadmap_iteration_id) : !managesOrg(accessContext, action.org_id))
    .map(action => action.id);
  return <Actions actions={actions} readOnlyIds={readOnlyIds} />;
}
