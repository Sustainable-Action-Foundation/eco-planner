import { getOneMetaRoadmap } from "@/fetchers";
import accessChecker from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { AccessLevel } from "@/types/enums";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoadmapTable from "@/components/tables/roadmapTables/roadmapTable";
import { AdminPanel } from "@/components/elements/controls/controls";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import Link from "next/link";
import TextEditor from "@/components/form/elements/textEditor/editor";

export async function generateMetadata(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params;
  const [t, session, metaRoadmap] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/metaRoadmap/${params.metaRoadmapId}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: metaRoadmap?.name,
    description: metaRoadmap?.description,
    og_url: `/metaRoadmap/${params.metaRoadmapId}`,
    og_image_url: undefined,
  });
}


export default async function Page(props: { params: Promise<{ metaRoadmapId: string }> }) {
  const params = await props.params;
  const [t, session, metaRoadmap] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneMetaRoadmap(params.metaRoadmapId),
  ]);

  const accessLevel = accessChecker(metaRoadmap, session.user);

  // 404 if the meta roadmap doesn't exist or the user doesn't have access
  if (!metaRoadmap) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={metaRoadmap} />

      {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) &&
        <AdminPanel accessLevel={accessLevel} object={metaRoadmap} />
      }

      <main>
        <section className="margin-block-300">
          <span style={{ color: 'gray' }}>{t("pages:roadmap_series_one.title_legend")}</span>
          <h1 className="margin-0">{metaRoadmap.name}</h1>
          <small>{t("pages:roadmap_series_one.description_legend")}</small>
          <div className="margin-block-100">
            <TextEditor
              id="rich-description"
              editable={false}
              defaultStyles={false}
              content={metaRoadmap.description}
            />
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap_series_one.roadmap_versions")}</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            {(accessLevel === AccessLevel.Edit || accessLevel === AccessLevel.Author || accessLevel === AccessLevel.Admin) ?
              <Link href={`/roadmap/create?metaRoadmapId=${metaRoadmap.id}`} className="button pureblack color-purewhite round">{t("pages:roadmap_series_one.create_roadmap_version")}</Link>
              : null}
          </menu>
          <RoadmapTable user={session.user} metaRoadmap={metaRoadmap} />
        </section>
      </main>
    </>
  );
}