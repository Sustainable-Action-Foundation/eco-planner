import { getSession } from '@/lib/session';
import RoadmapForm from '@/components/forms/roadmapForm/roadmapForm';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import getMetaRoadmaps from '@/fetchers/getMetaRoadmaps';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import Image from "next/image";
import { AccessLevel } from '@/types';
import accessChecker from '@/lib/accessChecker';
import getOneMetaRoadmap from '@/fetchers/getOneMetaRoadmap';
import serveTea from "@/lib/i18nServer";;
import { buildMetadata } from '@/functions/buildMetadata';

export async function generateMetadata() {
  const t = await serveTea("metadata")

  return buildMetadata({
    title: t("metadata:roadmap_create.title"),
    description: t('metadata:roadmap_create.description'),
    og_url: `/roadmap/create`,
    og_image_url: undefined
  })
}

export default async function Page(
  props: {
    searchParams: Promise<{
      metaRoadmapId?: string | string[] | undefined,
      [key: string]: string | string[] | undefined
    }>
  }
) {
  const searchParams = await props.searchParams;
  const [t, session, parent, metaRoadmapAlternatives] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneMetaRoadmap(typeof searchParams.metaRoadmapId == 'string' ? searchParams.metaRoadmapId : ''),
    getMetaRoadmaps(),
  ]);

  // User must be signed in
  if (!session.user) {
    return notFound();
  }

  const badMetaRoadmap = (
    searchParams.metaRoadmapId instanceof Array ||
    (!parent && typeof searchParams.metaRoadmapId == 'string') ||
    (parent && !([AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(parent, session.user))))
  );

  // The meta roadmaps the user can create the new roadmap under (the ones they have edit access to)
  const filteredAlternatives = metaRoadmapAlternatives.filter(metaRoadmap =>
    [AccessLevel.Edit, AccessLevel.Author, AccessLevel.Admin].includes(accessChecker(metaRoadmap, session.user))
  );

  return (
    <>
      <Breadcrumb object={parent || undefined} customSections={[t("pages:roadmap_create.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-block-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_create.title")}
        </h1>
        {badMetaRoadmap &&
          <p style={{ color: 'red' }}>
            <Image src="/icons/info.svg" width={24} height={24} alt='' />
            {t("pages:roadmap_create.bad_roadmap_series")} <br />
            {t("pages:roadmap_create.use_dropdown")}
          </p>
        }
        <RoadmapForm
          user={session.user}
          userGroups={session.user?.userGroups}
          metaRoadmapAlternatives={filteredAlternatives}
          defaultMetaRoadmap={badMetaRoadmap ? undefined : searchParams.metaRoadmapId as string | undefined}
        />
      </div>
    </>
  )
}