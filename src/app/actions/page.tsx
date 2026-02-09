import getOneAction from "@/fetchers/getActions"
import styles from './page.module.css'
import Actions from "./actions"
 
// NOTE: Do we really want the entire page to be async?
export default async function Page() {
  const actions = await getOneAction()
  
  return (
    <main>
      <h1 className="margin-top-300 margin-bottom-50 padding-bottom-50" style={{borderBottom: '1px solid var(--gray-80)'}}>Åtgärder</h1>
      <Actions actions={actions} />
    </main>
  )
}
