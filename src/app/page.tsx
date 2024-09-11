'use client';

import { LoginData } from "@/lib/session";
// import { cookies } from "next/headers";
import RoadmapTable from "@/components/tables/roadmapTable";
import AttributedImage from "@/components/generic/images/attributedImage";
import getMetaRoadmaps from "@/fetchers/getMetaRoadmaps";
import Image from "next/image";
import { useEffect, useState } from "react";
import clientGetUserSession from "@/lib/clientGetSession";
import { roadmapSorter, roadmapSorterAZ, roadmapSorterGoalAmount } from "@/lib/sorters";
import { RoadmapType } from "@prisma/client";

enum RoadmapSortBy {
  Default = "",
  Alpha = "ALPHA",
  AlphaReverse = "ALPHA REVERSE",
  GoalsFalling = "HIGH FIRST",
  GoalsRising = "LOW FIRST",
}

export default function Page() {
  // It's fine even if the user modifies their data here, as it will be verified on the server, and they won't have access to anything extra
  const [user, setUser] = useState<LoginData["user"] | null>(null);
  const [metaRoadmaps, setMetaRoadmaps] = useState<Awaited<ReturnType<typeof getMetaRoadmaps>> | null>(null);
  const [sortBy, setSortBy] = useState<RoadmapSortBy>(RoadmapSortBy.Default);
  const [typeFilter, setTypeFilter] = useState<RoadmapType[]>([])
  const [searchFilter, setSearchFilter] = useState<string>('')

  useEffect(() => {
    Promise.all([
      clientGetUserSession(),
      getMetaRoadmaps(),
    ]).then(([sessionData, metaRoadmapData]) => {
      setUser(sessionData);
      setMetaRoadmaps(metaRoadmapData);
    })
  }, []);

  if (!metaRoadmaps) {
    return (<p>Laddar data</p>);
  }

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
    <div className="rounded width-100 margin-y-100 position-relative overflow-hidden" style={{ height: '350px' }}>
      <AttributedImage src="/images/solarpanels.jpg" alt="" >
        <div className="flex gap-100 flex-wrap-wrap align-items-flex-end justify-content-space-between padding-100 width-100">
          <div>
            <h1 className="margin-y-25">Färdplaner</h1>
            <p className="margin-0">Photo by <a className="color-purewhite" href="https://unsplash.com/@markusspiske?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Markus Spiske</a> on <a className="color-purewhite" href="https://unsplash.com/photos/white-and-blue-solar-panels-pwFr_1SUXRo?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash" target="_blank">Unsplash</a></p>
          </div>
          { // Link to create roadmap form if logged in
            user &&
            <a href="/metaRoadmap/createMetaRoadmap" className="button purewhite round block" >Skapa ny färdplan</a>
          }
        </div>
      </AttributedImage>
    </div>
    <section>
      <section className="margin-y-100 padding-y-50" style={{ borderBottom: '2px solid var(--gray-90)' }}>
        <label className="font-weight-bold margin-y-25 container-text">
          Sök färdplan
          <div className="margin-y-50 flex align-items-center gray-90 padding-50 smooth focusable">
            <Image src='/icons/search.svg' alt="" width={24} height={24} />
            <input type="search" className="padding-0 margin-x-50" onChange={(e) => setSearchFilter(e.target.value)} />
          </div>
        </label>
        <div className="flex gap-100 align-items-center justify-content-space-between">
          <label className="margin-y-100 font-weight-bold">
            Sortera på:
            <select className="font-weight-bold margin-y-50 block" onChange={(e) => { setSortBy(e.target.value as RoadmapSortBy) }}>
              <option value="">Standard</option>
              <option value={RoadmapSortBy.Alpha}>Namn (A-Ö)</option>
              <option value={RoadmapSortBy.AlphaReverse}>Namn (Ö-A)</option>
              <option value={RoadmapSortBy.GoalsFalling}>Antal målbanor (fallande)</option>
              <option value={RoadmapSortBy.GoalsRising}>Antal målbanor (stigande)</option>
            </select>
          </label>
          <label className='flex align-items-center gap-50 padding-50 font-weight-bold button smooth transparent'>
            <span style={{ lineHeight: '1', }}>Filtrera</span>
            <div className='position-relative grid place-items-center'>
              <input type="checkbox" className="position-absolute width-100 height-100 hidden" />
              <Image src="/icons/filter.svg" alt="" width="24" height="24" />
            </div>
          </label>
        </div>
      </section>
      <section id="roadmapFilters" className="margin-y-200 padding-100 gray-90 rounded">
        <b>Visa</b>
        {Object.values(RoadmapType).map((thisType, key) => (
          <label className="flex align-items-center gap-25 margin-y-50" key={key}>
            <input type="checkbox" value={thisType} onChange={(e) => {
              if (e.target.checked) {
                setTypeFilter([...typeFilter, (e.target.value as RoadmapType)])
              } else {
                setTypeFilter(typeFilter.filter((item) => item != e.target.value))
              }
            }} />
            {`${thisType == RoadmapType.NATIONAL ? "Nationella" :
              thisType == RoadmapType.REGIONAL ? "Regionala" :
                thisType == RoadmapType.MUNICIPAL ? "Kommunala" :
                  thisType == RoadmapType.LOCAL ? "Lokala" :
                    thisType == RoadmapType.OTHER ? "Övriga" :
                      thisType
              } färdplaner`}
          </label>
        ))}
      </section>
    </section>
    <section>
      <RoadmapTable user={user ?? undefined} roadmaps={roadmaps} />
    </section>
  </>
}