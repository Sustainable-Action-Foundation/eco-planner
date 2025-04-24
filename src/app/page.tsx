import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import AttributedImage, { AttributeText } from "@/components/generic/images/attributedImage";
import getMetaRoadmaps from "@/fetchers/getMetaRoadmaps";;
import { roadmapSorter, roadmapSorterAZ, roadmapSorterGoalAmount } from "@/lib/sorters";
import { RoadmapType } from "@prisma/client";
import RoadmapFilters from "@/components/forms/filters/roadmapFilters";
import { RoadmapSortBy } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import RoadmapTree from "@/components/tables/roadmapTables/roadmapTree.tsx";
import { t } from "@/lib/i18nServer";
import Link from "next/link";

export default async function Page(
  props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const searchParams = await props.searchParams;
  const [session, metaRoadmaps] = await Promise.all([
    getSession(await cookies()),
    getMetaRoadmaps(),
  ]);

  const typeFilter = searchParams['typeFilter'] ? (Array.isArray(searchParams['typeFilter']) ? searchParams['typeFilter'] : [searchParams['typeFilter']]) : [];
  const sortBy = searchParams['sortBy'] ? (Array.isArray(searchParams['sortBy']) ? (searchParams['sortBy'][0] as RoadmapSortBy) : (searchParams['sortBy'] as RoadmapSortBy)) : RoadmapSortBy.Default;
  const searchFilter = searchParams['searchFilter'] ? (Array.isArray(searchParams['searchFilter']) ? searchParams['searchFilter'][0] : searchParams['searchFilter']) : '';

  // Get the latest version of all roadmaps
  let roadmaps: (typeof metaRoadmaps[number] & { metaRoadmap: typeof metaRoadmaps[number] })['roadmapVersions'] = [];
  metaRoadmaps.forEach(metaRoadmap => {
    if (metaRoadmap.roadmapVersions.length) {
      const foundRoadmap = metaRoadmap.roadmapVersions.find(roadmap => roadmap.version === Math.max(...metaRoadmap.roadmapVersions.map(roadmap => roadmap.version)));
      if (foundRoadmap) {
        foundRoadmap.metaRoadmap = metaRoadmap;
        roadmaps.push(foundRoadmap);
      }
    }
  })

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
    })
  }

  // Filter by searchFilter
  if (searchFilter) {
    roadmaps = roadmaps.filter((roadmap) => {
      if (Object.values(roadmap).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase())
        } else {
          return false;
        }
      })) {
        return true;
      } else if (Object.values(roadmap.metaRoadmap).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchFilter.toLowerCase())
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
      roadmaps.sort(roadmapSorterGoalAmount)
      break;
    case RoadmapSortBy.GoalsRising:
      roadmaps.sort(roadmapSorterGoalAmount)
      roadmaps.reverse()
      break;
    case RoadmapSortBy.Default:
    default:
      roadmaps.sort(roadmapSorter)
      break;
  }

  /*
  const nationalMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => metaRoadmap.type === RoadmapType.NATIONAL)
  // TODO: Use all of these, and change `regionalMetaRoadmaps` to be those with `type === RoadmapType.REGIONAL`
  const regionalMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => metaRoadmap.type !== RoadmapType.NATIONAL)
  const municipalMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => metaRoadmap.type === RoadmapType.MUNICIPAL)
  const localMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => metaRoadmap.type === RoadmapType.LOCAL)
  const otherMetaRoadmaps = metaRoadmaps.filter(metaRoadmap => metaRoadmap.type === RoadmapType.OTHER || !Object.values(RoadmapType).includes(metaRoadmap.type))
  */

  return <>
    <Breadcrumb />

    <div className="rounded width-100 margin-bottom-100 margin-top-300 position-relative overflow-hidden" style={{ height: '350px' }}>
      <AttributedImage src="/images/solarpanels.jpg" alt="" sizes="(max-width: 1250: 100vw), 1250px">
        <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between padding-100 width-100">
          <div>
            <h1 className="margin-block-25">{t("pages:home.title")}</h1>
            <AttributeText
              author={"Markus Spiske"}
              authorLink="https://unsplash.com/@markusspiske?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash"
              source={"Unsplash"}
              sourceLink="https://unsplash.com/photos/white-and-blue-solar-panels-pwFr_1SUXRo?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" />
          </div>
          { // Link to create roadmap form if logged in
            session.user &&
            <>
              <Link href="/metaRoadmap/create" className="button purewhite round block">{t("pages:home.create_roadmap")}</Link>
              {/* TODO: Incorporate this in a reasonable way */}
              {/* <a href="/roadmap/createRoadmap" className="button purewhite round block"></a> */}
            </>
          }
        </div>
      </AttributedImage>
    </div>

    <section>
      <RoadmapFilters />
    </section>

    <section className="margin-bottom-500">
      <RoadmapTree user={session.user ?? undefined} roadmaps={roadmaps} />
    </section>
  </>
}