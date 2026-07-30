import { getSession } from '@/lib/session';
import RoadmapForm from '@/components/form/forms/roadmap';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getRoadmaps } from '@/fetchers';
import { getOrgOptions } from '@/fetchers/getOrgOptions';
import { Breadcrumb } from '@/components/breadcrumbs/breadcrumb';
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from '@/functions/buildMetadata';
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");

  return buildMetadata({
    title: t("metadata:roadmap_create.title"),
    description: t("metadata:roadmap_create.description"),
    og_url: `/roadmap/create`,
    og_image_url: undefined,
  });
}

export default async function Page() {
  const [t, session, parentRoadmapOptions, orgOptions] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getRoadmaps(),
    getOrgOptions(),
  ]);

  // User must be signed in and be able to create in some org
  if (!session.user || orgOptions.length === 0) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb customSections={[t("pages:roadmap_create.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_create.title")}
        </h1>
        <RoadmapForm
          isSuperAdmin={session.user.isSuperAdmin}
          orgOptions={orgOptions}
          parentRoadmapOptions={parentRoadmapOptions}
        />
      </div>
    </>
  );
}
