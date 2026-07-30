import RoadmapIterationForm from "@/components/form/forms/roadmapIteration";
import { getRoadmapIterationByVersion, getUserAccessContext } from "@/fetchers";
import { parseVersionSlug } from "@/functions/versionSlug";
import { getSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string, version: string }> }): Promise<Metadata> {
  const params = await props.params;
  const version = parseVersionSlug(params.version);
  const [t, session, iteration] = await Promise.all([
    serveTea("metadata"),
    getSession(await cookies()),
    version == null ? null : getRoadmapIterationByVersion(params.roadmapId, version),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/roadmap/${params.roadmapId}/${params.version}/edit`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: `${t("metadata:roadmap_iteration_edit.title")} ${iteration?.roadmap.name}`,
    description: iteration?.description || iteration?.roadmap.description,
    og_url: `/roadmap/${params.roadmapId}/${params.version}/edit`,
    og_image_url: undefined,
  });
}


export default async function Page(props: { params: Promise<{ roadmapId: string, version: string }> }) {
  const params = await props.params;
  const version = parseVersionSlug(params.version);
  if (version == null) {
    return notFound();
  }
  const [t, session, accessContext, iteration] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getUserAccessContext(),
    getRoadmapIterationByVersion(params.roadmapId, version),
  ]);

  const access = accessChecker(
    iteration ? { access_control: iteration.roadmap.access_control, published_at: iteration.published_at } : null,
    accessContext,
  );

  // User must be signed in and have edit access to the iteration, which must exist
  if (!session.user || !iteration || !hasEditAccess(access)) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={iteration} customSections={[t("pages:roadmap_iteration_edit.breadcrumb")]} />

      <div className='container-text margin-inline-auto'>
        <h1 className='margin-top-300 padding-bottom-100 margin-right-300' style={{ borderBottom: '1px solid var(--gray-90)' }}>
          {t("pages:roadmap_iteration_edit.title")} {/* TODO: Need a better name here... */}
        </h1>
        <RoadmapIterationForm
          currentIteration={iteration}
        />
      </div>
    </>
  );
}
