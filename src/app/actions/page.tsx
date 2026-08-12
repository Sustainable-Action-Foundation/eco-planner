import { getActions } from "@/fetchers";
import Actions from "../../components/pages/sections/actions";
import serveTea from "@/lib/i18nServer"; 
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { buildMetadata } from "@/functions/buildMetadata";
import type { Metadata } from "next";
 
// TODO: More detailed metadata?
export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("metadata");
  return await buildMetadata({
    title: t("metadata:actions.title"),
    description: undefined,
    og_url: undefined,
    og_image_url: undefined,
  });
}

export default async function Page() {
  const [t, actions] = await Promise.all([
    serveTea("pages"),
    getActions(),
  ]);

  return (
    <>
      <Breadcrumb customSections={[t('pages:actions.actions')]} />

      <main>
        <h1 className="margin-block-300 padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>{t('pages:actions.actions')}</h1>
        <Actions actions={actions} />
      </main>
    </>
  );
}
