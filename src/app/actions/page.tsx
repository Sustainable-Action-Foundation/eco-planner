import getOneAction from "@/fetchers/getActions"
import styles from './page.module.css'
import Actions from "../../components/actions"
import serveTea from "@/lib/i18nServer";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
import { Breadcrumb } from "@/components/breadcrumbs/breadcrumb";

// NOTE: Do we really want the entire page to be async?
export default async function Page(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [t, searchParams, session, actions] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getSession(await cookies()),
    getOneAction(),
  ]);

  return (
    <>
      <Breadcrumb customSections={['Åtgärder']} /> {/* TODO: I18n */}

      <main>
        <h1 className="margin-block-300 padding-bottom-100" style={{ borderBottom: '1px solid var(--gray-80)' }}>Åtgärder</h1> {/* TODO: I18n */}
        <Actions searchParamsProp={searchParams} actions={actions} />
      </main>
    </>
  )
}
