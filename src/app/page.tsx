import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import { roadmapSorter, roadmapSorterAZ, roadmapSorterGoalAmount } from "@/lib/sorters";
import { RoadmapType } from "@/lib/prisma/generated";
import RoadmapFilters from "@/components/form/filters/roadmapFilters";
import { RoadmapSortBy } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapTree from "@/components/tables/roadmapTables/roadmapTree";
import serveTea from "@/lib/i18nServer";
import Link from "next/link";
import { buildMetadata } from "@/functions/buildMetadata";
import { getMetaRoadmaps, getRoadmaps } from "@/fetchers";
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
  const [t, searchParams, session, metaRoadmaps] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getSession(await cookies()),
    getMetaRoadmaps(),
  ]);

  const typeFilter = searchParams['typeFilter'] ? (Array.isArray(searchParams['typeFilter']) ? searchParams['typeFilter'] : [searchParams['typeFilter']]) : [];
  const sortBy = searchParams['sortBy'] ? (Array.isArray(searchParams['sortBy']) ? (searchParams['sortBy'][0] as RoadmapSortBy) : (searchParams['sortBy'] as RoadmapSortBy)) : RoadmapSortBy.Default;
  const searchFilter = searchParams['searchFilter'] ? (Array.isArray(searchParams['searchFilter']) ? searchParams['searchFilter'][0] : searchParams['searchFilter']) : '';

  // Get the latest version ids, then fetch proper roadmaps with access and counts
  const latestRoadmapIds = metaRoadmaps.flatMap(metaRoadmap => {
    if (!metaRoadmap.roadmapVersions.length) {
      return [];
    }

    const latestRoadmap = metaRoadmap.roadmapVersions.reduce((current, candidate) =>
      candidate.version > current.version ? candidate : current,
    );

    return latestRoadmap.id ? [latestRoadmap.id] : [];
  });

  let roadmaps = latestRoadmapIds.length ? await getRoadmaps(latestRoadmapIds) : [];

  // Filter by typeFilter
  if (typeFilter.length) {
    roadmaps = roadmaps.filter((roadmap) => {
      if (typeFilter.includes(roadmap.metaRoadmap.type)) {
        return true;
        // If the user has selected RoadmapType.OTHER, include all roadmaps with bad values (not included in RoadmapType enum) for roadmap.metaRoadmap.type too
      } else if (typeFilter.includes(RoadmapType.OTHER) && !Object.values(RoadmapType).includes(roadmap.metaRoadmap.type)) {
        return true;
      } else {
        return false;
      }
    });
  }

  // Filter by searchFilter
  if (searchFilter) {
    roadmaps = roadmaps.filter((roadmap) => {
      if (Object.values(roadmap).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase());
        } else {
          return false;
        }
      })) {
        return true;
      } else if (Object.values(roadmap.metaRoadmap).some((value) => {
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
    case RoadmapSortBy.Alpha:
      roadmaps.sort(roadmapSorterAZ);
      break;
    case RoadmapSortBy.AlphaReverse:
      roadmaps.sort(roadmapSorterAZ);
      roadmaps.reverse();
      break;
    case RoadmapSortBy.GoalsFalling:
      roadmaps.sort(roadmapSorterGoalAmount);
      break;
    case RoadmapSortBy.GoalsRising:
      roadmaps.sort(roadmapSorterGoalAmount);
      roadmaps.reverse();
      break;
    case RoadmapSortBy.Default:
    default:
      roadmaps.sort(roadmapSorter);
      break;
  }

  return <>
    <Breadcrumb />

    <main>
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
                ? <Link href="/metaRoadmap/create" className="button purewhite round block">{t("pages:home.create_roadmap")}</Link>
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
          <h2 id="roadmap-search-title" className="margin-top-0 margin-bottom-50 font-weight-600">{t("pages:home.search_roadmaps", { count: metaRoadmaps.filter((metaRoadmap) => metaRoadmap.roadmapVersions.length > 0).length })}</h2>
          <SearchRoadmaps labelledBy="roadmap-search-title" />
          <div className="flex align-items-center gap-100 flex-wrap-wrap justify-content-space-between margin-bottom-200 margin-top-50">
            <small className="font-size-100" aria-live="polite"> {/* TODO: Pretty sure this should have an aria-live but double check against a screenreader */}
              {t("pages:home.shown_results", {
                shown: roadmaps.length,
                total: metaRoadmaps.filter((metaRoadmap) => metaRoadmap.roadmapVersions.length > 0).length,
              })}
            </small>
            <SortRoadmaps />

          </div>
          <output>
            <RoadmapTree
              user={session.user ?? undefined}
              roadmaps={roadmaps}
            />
          </output>
        </div>
      </search>
      {/*
      <section>
        <RoadmapFilters />
      </section>

      TODO: There might be some issues with displayning public roadmaps, explore this. 
      <section className="margin-bottom-500">
        <RoadmapTree
          user={session.user ?? undefined}
          roadmaps={roadmaps}
        />
      </section>  */}
    </main>
  </>;
}