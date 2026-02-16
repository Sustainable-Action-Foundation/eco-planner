import getOneAction from "@/fetchers/getActions"
import styles from './page.module.css'
import Actions from "../../components/actions"
import serveTea from "@/lib/i18nServer";
import { getSession } from "@/lib/session";
import { cookies } from "next/headers";
 
// NOTE: Do we really want the entire page to be async?
export default async function Page(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [t, searchParams, session, actions] = await Promise.all([
    serveTea("pages"),
    props.searchParams,
    getSession(await cookies()),
    getOneAction(),
  ]);
  
  return (
    <main>
      <Actions searchParamsProp={searchParams} actions={actions} />
    </main>
  )
}
