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
      <Breadcrumb object={roadmap} />

      <div className="display-flex justify-content-space-between flex-wrap-wrap" style={{ borderBottom: '2px dashed var(--gray-90)', marginTop: '2rem' }}>
        <div className="flex-grow-100 margin-block-100" style={{ minWidth: 'max-content' }}>
          <span style={{ color: 'gray' }}>Färdplan</span>
          <h1 className="margin-0">{roadmap.metaRoadmap.name}</h1>
          <p className="margin-0">
            {(roadmap.metaRoadmap.actor) &&
              <> {roadmap.metaRoadmap.actor} • </>
            }
            {roadmap.goals.length} målbanor
          </p>
        </div>
        { // Only show the edit link if the user has edit access to the roadmap
          (accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
          <aside className="display-flex justify-content-flex-end margin-block-100">
            <a href={`/roadmap/${roadmap.id}/editRoadmap`} className="display-flex align-items-center gap-50" style={{ textDecoration: 'none', color: 'black', fontWeight: '500', height: 'fit-content' }}>
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