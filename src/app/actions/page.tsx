import { getActions } from "@/fetchers";
import Actions from "../../components/pages/sections/actions";
import serveTea from "@/lib/i18nServer"; 
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";
import { buildMetadata } from "@/functions/buildMetadata";
import type { Metadata } from "next";
 
// TODO: More detailed metadata?
export async function generateMetadata(): Promise<Metadata> {
  return await buildMetadata({
    title: 'Åtgärder',
    description: undefined,
    og_url: undefined,
    og_image_url: undefined,
  });
}

export default async function Page(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [t, searchParams, actions] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getActions(),
  ]);

  return (
    <>
      <Breadcrumb customSections={[t('pages:actions.actions')]} />

      <main>
        <h1 className="margin-block-300 padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>{t('pages:actions.actions')}</h1>
        <Actions searchParamsProp={searchParams} actions={actions} />
      </main>
    </>
  );
}
