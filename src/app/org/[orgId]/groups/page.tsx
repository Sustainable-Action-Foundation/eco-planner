import { getOrgManagement } from "@/fetchers";
import GroupManager from "@/components/pages/groupManager";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import serveTea from "@/lib/i18nServer";
import { buildMetadata } from "@/functions/buildMetadata";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(props: { params: Promise<{ orgId: string }> }): Promise<Metadata> {
  const [t, params] = await Promise.all([serveTea("metadata"), props.params]);
  return await buildMetadata({
    title: t("metadata:org_groups.title"),
    description: undefined,
    og_url: `/org/${params.orgId}/groups`,
    og_image_url: undefined,
  });
}

export default async function Page(props: { params: Promise<{ orgId: string }> }) {
  const params = await props.params;
  const [t, management] = await Promise.all([
    serveTea(["pages", "common"]),
    getOrgManagement(params.orgId),
  ]);

  // Managers only; hide the page's existence from everyone else
  if (!management) {
    notFound();
  }

  return (
    <>
      <Breadcrumb customSections={[management.org.name, t("pages:org_groups.title")]} />

      <main className="padding-bottom-500">
        <h1 className="margin-block-300 padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>
          {t("pages:org_groups.heading", { org: management.org.name })}
        </h1>
        <p className="margin-bottom-200">{t("pages:org_groups.description")}</p>
        <GroupManager management={management} />
      </main>
    </>
  );
}
