import { getOneRoadmap, getUserAccessContext } from "@/fetchers";
import accessChecker, { hasEditAccess } from "@/lib/accessChecker";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoadmapTable from "@/components/tables/roadmapTables/roadmapTable";
import { AdminPanel } from "@/components/elements/controls/controls";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import Link from "next/link";
import TextEditor from "@/components/form/elements/textEditor/editor";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ roadmapId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const [t, session, roadmap] = await Promise.all([
    serveTea("pages"),
    getSession(await cookies()),
    getOneRoadmap(params.roadmapId),
  ]);

  if (!session.user?.isLoggedIn) {
    return buildMetadata({
      title: t("metadata:login.title"),
      description: t("metadata:login.title"),
      og_url: `/roadmap/${params.roadmapId}`,
      og_image_url: '/images/og_wind.png',
    });
  }

  return buildMetadata({
    title: roadmap?.name,
    description: roadmap?.description,
    og_url: `/roadmap/${params.roadmapId}`,
    og_image_url: undefined,
  });
}


export default async function Page(props: { params: Promise<{ roadmapId: string }> }) {
  const params = await props.params;
  const [t, accessContext, roadmap] = await Promise.all([
    serveTea("pages"),
    getUserAccessContext(),
    getOneRoadmap(params.roadmapId),
  ]);

  const accessLevel = accessChecker(roadmap, accessContext);

  // 404 if the roadmap doesn't exist or the user doesn't have access
  if (!roadmap) {
    return notFound();
  }

  return (
    <>
      <Breadcrumb object={roadmap} />

      {hasEditAccess(accessLevel) &&
        <AdminPanel accessLevel={accessLevel} object={roadmap} />
      }

      <main>
        <section className="margin-block-300">
          <span style={{ color: 'gray' }}>{t("pages:roadmap.title_legend")}</span>
          <h1 className="margin-0">{roadmap.name}</h1>
          <small>{t("pages:roadmap.description_legend")}</small>
          <div className="margin-block-100">
            <TextEditor
              id="rich-description"
              editable={false}
              defaultStyles={false}
              content={roadmap.description}
            />
          </div>
        </section>

        <section className="margin-block-300">
          <h2 className="margin-block-100 padding-bottom-50" style={{ borderBottom: '1px solid var(--gray)' }}>{t("pages:roadmap.roadmap_versions")}</h2>
          <menu className="margin-0 padding-0 margin-bottom-100 flex justify-content-flex-end">
            {hasEditAccess(accessLevel) ?
              <Link href={`/roadmap-iteration/create?roadmapId=${roadmap.id}`} className="button pureblack color-purewhite round">{t("pages:roadmap.create_roadmap_version")}</Link>
              : null}
          </menu>
          <RoadmapTable accessContext={accessContext} roadmap={roadmap} />
        </section>
      </main>
    </>
  );
}
