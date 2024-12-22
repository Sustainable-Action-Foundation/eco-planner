import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import accessChecker from "@/lib/accessChecker";
import { AccessLevel } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode,
  params: { roadmapId: string }
}) {

  const [session, roadmap] = await Promise.all([
    getSession(cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  let accessLevel: AccessLevel = AccessLevel.None;
  if (roadmap) {
    accessLevel = accessChecker(roadmap, session.user)
  }

  // 404 if the roadmap doesn't exist or if the user doesn't have access to it
  if (!roadmap || !accessLevel) {
    return notFound();
  }

  return (
    <>
      {/* TODO: This entire layout should be moved to the page */}
      <Breadcrumb object={roadmap} />

      <div className="display-flex justify-content-space-between flex-wrap-wrap margin-top-200" style={{ borderBottom: '2px dashed var(--gray-90)'}}>
        <div className="flex-grow-100 margin-block-100">
          <span style={{ color: 'gray' }}>Färdplan</span>
          <h1 className="margin-0">{roadmap.metaRoadmap.name}</h1>
          <p className="margin-0">
            {(roadmap.metaRoadmap.actor) &&
              <> {roadmap.metaRoadmap.actor} • </>
            }
            {roadmap.goals.length} målbanor
          </p>
          <p className="margin-bottom-0">{roadmap.metaRoadmap.description}</p>
        </div>
        { // Only show the edit link if the user has edit access to the roadmap
          (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <aside className="display-flex justify-content-flex-end margin-bottom-100">
            <a href={`/roadmap/${roadmap.id}/editRoadmap`} className="display-flex align-items-center gap-50 font-weight-500" style={{ textDecoration: 'none', color: 'black', height: 'fit-content' }}>
              Redigera färdplan
              <Image src="/icons/edit.svg" alt="" width="24" height="24" />
            </a>
          </aside>
        }
      </div>
      {children}
    </>
  )
}