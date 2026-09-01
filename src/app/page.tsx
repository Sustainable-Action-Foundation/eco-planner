import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import { roadmapIterationSorter, roadmapSorterAZ, roadmapSorterGoalAmount } from "@/lib/sorters";
import { IterationStatus, OrgRole, RoadmapType } from "@/lib/prisma/generated";
import RoadmapFilters from "@/components/form/filters/roadmapFilters";
import { RoadmapSortBy } from "@/types/enums";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapTree from "@/components/tables/roadmapTables/roadmapTree";
import serveTea from "@/lib/i18nServer";
import Link from "next/link";
import { buildMetadata } from "@/functions/buildMetadata";
import { getActions, getRoadmapIterations, getRoadmaps, getUserOrgs } from "@/fetchers";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import Actions from "@/components/pages/sections/actions";
import CuratedHistoricalData from "@/components/pages/sections/historicalData";
import Image from "next/image";
import { Suspense } from "react";
import SearchRoadmaps from "@/components/form/filters/searchRoadmaps";
import SortRoadmaps from "@/components/form/filters/sortRoadmaps";
import styles from "./page.module.css";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return await buildMetadata({
    title: undefined,
    description: undefined,
    og_url: undefined,
    og_image_url: undefined,
  });
}

export default async function Page(
  props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> },
) {
  const [t, searchParams, session, accessContext, roadmaps, userOrgs] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getSession(await cookies()),
    getUserAccessContext(),
    getRoadmaps(),
    getUserOrgs(),
  ]);

  // Org members land on their org's landing page; ?org= switches between the
  // user's orgs (guest ones included) and the public view. The default is the
  // first proper membership: org-less users and pure guests get the public view
  // and reach their org through its tab, since a guest's org landing only holds
  // what their groups are explicitly granted. Super admins get every org in the
  // switcher (memberships first), so one without a membership lands on the
  // first org instead of the public view.
  const orgParam = searchParams['org'] ? (Array.isArray(searchParams['org']) ? searchParams['org'][0] : searchParams['org']) : '';
  const selectedOrg = orgParam === 'public'
    ? null
    : userOrgs.find(org => org.id === orgParam)
      ?? userOrgs.find(org => org.isMember && !org.isGuest)
      ?? (accessContext?.isSuperAdmin ? userOrgs[0] : null)
      ?? null;

  const typeFilter = searchParams['typeFilter'] ? (Array.isArray(searchParams['typeFilter']) ? searchParams['typeFilter'] : [searchParams['typeFilter']]) : [];
  const sortBy = searchParams['sortBy'] ? (Array.isArray(searchParams['sortBy']) ? (searchParams['sortBy'][0] as RoadmapSortBy) : (searchParams['sortBy'] as RoadmapSortBy)) : RoadmapSortBy.Default;
  const searchFilter = searchParams['searchFilter'] ? (Array.isArray(searchParams['searchFilter']) ? searchParams['searchFilter'][0] : searchParams['searchFilter']) : '';

  // Per roadmap: the latest published version is its node in the tree, and any
  // drafts nest under it (drafts only reach editors via the existing access filter)
  const treeIterationIds = roadmaps.flatMap(roadmap => {
    const accessLevel = accessChecker(roadmap, accessContext);
    const published = roadmap.iterations.filter(iteration => iteration.status === IterationStatus.PUBLISHED);
    const drafts = hasEditAccess(accessLevel) ? roadmap.iterations.filter(iteration => iteration.status === IterationStatus.DRAFT) : [];

    const latestPublished = published.length
      ? published.reduce((current, candidate) => candidate.version > current.version ? candidate : current)
      : null;

    return [...(latestPublished ? [latestPublished.id] : []), ...drafts.map(draft => draft.id)];
  });

  let iterations = treeIterationIds.length ? await getRoadmapIterations(treeIterationIds) : [];

  // Filter by typeFilter
  if (typeFilter.length) {
    iterations = iterations.filter((iteration) => {
      if (typeFilter.includes(iteration.roadmap.type)) {
        return true;
        // If the user has selected RoadmapType.OTHER, include all iterations with bad values (not included in RoadmapType enum) for iteration.roadmap.type too
      } else if (typeFilter.includes(RoadmapType.OTHER) && !Object.values(RoadmapType).includes(iteration.roadmap.type)) {
        return true;
      } else {
        return false;
      }
    });
  }

  // Filter by searchFilter
  if (searchFilter) {
    iterations = iterations.filter((iteration) => {
      if (Object.values(iteration).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase());
        } else {
          return false;
        }
      })) {
        return true;
      } else if (Object.values(iteration.roadmap).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase());
        } else {
          return false;
        }
      })) {
        return true;
      } else {
        return false;
      }
    });
  }

  // Sort
  switch (sortBy) {
    case RoadmapSortBy.Alpha: {
      iterations.sort(roadmapSorterAZ);
      break;
    }
    case RoadmapSortBy.AlphaReverse: {
      iterations.sort(roadmapSorterAZ);
      iterations.reverse();
      break;
    }
    case RoadmapSortBy.GoalsFalling: {
      iterations.sort(roadmapSorterGoalAmount);
      break;
    }
    case RoadmapSortBy.GoalsRising: {
      iterations.sort(roadmapSorterGoalAmount);
      iterations.reverse();
      break;
    }
    case RoadmapSortBy.Default:
    default: {
      iterations.sort(roadmapIterationSorter);
      break;
    }
  }

  // Org landing: only the roadmaps owned by (and readable in) the selected org,
  // plus the org's actions. The searchParam filters above still apply, so deep
  // links like /?searchFilter=... behave the same on both views.
  const orgIterations = selectedOrg
    ? iterations.filter(iteration => iteration.roadmap.access_control.org_id === selectedOrg.id)
    : [];
  const orgActions = selectedOrg
    ? (await getActions()).filter(action => action.org_id === selectedOrg.id)
    : null;

  return <>
    <Breadcrumb />

    <main>
      {userOrgs.length > 0 ?
        <nav className="flex gap-50 flex-wrap-wrap margin-top-300" aria-label={t("pages:home.org_nav_label")}>
          {userOrgs.map(org => (
            <Link
              key={org.id}
              href={`/?org=${org.id}`}
              className={`button round smooth${selectedOrg?.id === org.id ? ' seagreen color-purewhite font-weight-500' : ''}`}
            >
              {org.name}
            </Link>
          ))}
          <Link
            href="/?org=public"
            className={`button round smooth${!selectedOrg ? ' seagreen color-purewhite font-weight-500' : ''}`}
          >
            {t("pages:home.public_tab")}
          </Link>
        </nav>
        : null}

      {selectedOrg ? <>
        {/* Solid color stand-in until orgs get custom landing images */}
        <div className="rounded width-100 margin-bottom-100 margin-top-100 flex align-items-flex-end" style={{ height: '350px', backgroundColor: 'var(--seagreen)' }}>
          <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between padding-100 width-100">
            <h1 className="margin-block-25 color-purewhite" data-testid="home-title">{selectedOrg.name}</h1>
            <div className="flex gap-50 flex-wrap-wrap">
              { // Managers also administer the org's groups
                accessContext?.isSuperAdmin || accessContext?.memberships.some(membership => membership.orgId === selectedOrg.id && membership.role === OrgRole.MANAGER)
                  ? <Link href={`/org/${selectedOrg.id}/groups`} className="button purewhite round block">{t("pages:org_groups.manage_groups")}</Link>
                  : null
              }
              { // Link to create roadmap form if logged in
                session.user
                  ? <Link href="/roadmap/create" className="button purewhite round block">{t("pages:home.create_roadmap")}</Link>
                  : null
              }
            </div>
          </div>
        </div>

        <section className="margin-top-200">
          <h2 className="margin-top-0 margin-bottom-100 font-weight-600">{t("pages:home.title")}</h2>
          <RoadmapTree
            accessContext={accessContext}
            iterations={orgIterations}
          />
        </section>

        <section className="margin-block-300">
          <Actions actions={orgActions} />
        </section>

        { // Curated historical data needs a geo area to localize to
          selectedOrg.geoArea ?
            <section className="margin-block-300">
              {/* The section fetches from external statistics APIs; don't block the rest of the page on a cold cache */}
              <Suspense fallback={<Image src={'/loaders/3-dots-move.svg'} width={24} height={24} alt='' aria-live="polite" />}>
                <CuratedHistoricalData geoArea={selectedOrg.geoArea} />
              </Suspense>
            </section>
            : null}
      </> : <>
      <div className="rounded width-100 margin-bottom-100 margin-top-300 position-relative overflow-hidden" style={{ height: '350px' }}>
        <AttributedImage src="/images/solar.jpg" alt="" sizes="(max-width: 1250px) 100vw, 1250px">
          <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between padding-100 width-100">
            <div>
              <h1 className="margin-block-25" data-testid="home-title">{t("pages:home.title")}</h1>
              <AttributeText
                author={"Markus Spiske"}
                authorLink="https://unsplash.com/@markusspiske?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
                source={"Unsplash"}
                sourceLink="https://unsplash.com/photos/white-and-blue-solar-panels-pwFr_1SUXRo?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" />
            </div>
            { // Link to create roadmap form if logged in
              session.user
                ? <Link href="/roadmap/create" className="button purewhite round block">{t("pages:home.create_roadmap")}</Link>
                : null
            }
          </div>
        </AttributedImage>
      </div>

      <search className={`${styles['layout-roadmaps']}`}>
        <aside className='height-fit-content' tabIndex={-1} id="roadmap-filters">
          <h2 className="font-size-125 margin-top-50 font-weight-600 padding-bottom-50 margin-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>
            {t("pages:home.filter")}
          </h2>
          <RoadmapFilters />
        </aside>
        <div className="flex-grow-infinity max-width-100">
          <h2 id="roadmap-search-title" className="margin-top-0 margin-bottom-50 font-weight-600">{t("pages:home.search_roadmaps", { count: roadmaps.filter((roadmap) => roadmap.iterations.length > 0).length })}</h2>
          <SearchRoadmaps labelledBy="roadmap-search-title" />
          <div className="flex align-items-center gap-100 flex-wrap-wrap justify-content-space-between margin-bottom-200 margin-top-50">
            <small className="font-size-100" aria-live="polite"> {/* TODO: Pretty sure this should have an aria-live but double check against a screenreader */}
              {t("pages:home.shown_results", {
                // One row per roadmap; its drafts nest under it
                shown: new Set(iterations.map(iteration => iteration.roadmap_id)).size,
                total: roadmaps.filter((roadmap) => roadmap.iterations.length > 0).length,
              })}
            </small>
            <SortRoadmaps />
          </div>
          <RoadmapTree
            accessContext={accessContext}
            iterations={iterations}
          />
        </div>
      </search>
      </>}
      {/*
      <section>
        <RoadmapFilters />
      </section>

      TODO: There might be some issues with displaying public roadmaps, explore this.
      <section className="margin-bottom-500">
        <RoadmapTree
          accessContext={accessContext}
          iterations={iterations}
        />
      </section>  */}
    </main>
  </>;
}
