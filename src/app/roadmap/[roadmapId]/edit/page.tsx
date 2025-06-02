import RoadmapForm from "@/components/forms/roadmapForm/roadmapForm";
import getOneRoadmap from "@/fetchers/getOneRoadmap";
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import accessChecker from "@/lib/accessChecker";
import { AccessLevel } from "@/types";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { ScopeReminder } from "@/components/forms/roadmapForm/scopeReminder";
import { buildMetadata } from "@/functions/buildMetadata";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params
  const [t, roadmap] = await Promise.all([
    serveTea("metadata"),
    getOneRoadmap(params.roadmapId)
  ]);

  return buildMetadata({
    title: `${t("metadata:roadmap_edit.title")} ${roadmap?.metaRoadmap.name}`,
    description: roadmap?.description || roadmap?.metaRoadmap.description,
    og_url: `/roadmap/${params.roadmapId}/edit`,
    og_image_url: undefined
  })
}


export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  const access = accessChecker(roadmap, session.user)

  // User must be signed in and have edit access to the roadmap, which must exist
  if (!session.user || !roadmap || access == AccessLevel.None || access == AccessLevel.View) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={roadmap} customSections={[t("pages:roadmap_edit.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_edit.title")}
        </h1>
        <ScopeReminder roadmap={roadmap} />
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          currentRoadmap={roadmap}
        />
      </div>
    </>
  )
}