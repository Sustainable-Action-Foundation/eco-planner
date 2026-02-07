import getOneAction from "@/fetchers/getActions"
import styles from './page.module.css'
import Actions from "./actions"
 
// NOTE: Do we really want the entire page to be async?
export default async function Page() {
  const actions = await getOneAction()
  
  return (
    <>
      <h1>Åtgärder</h1>
      <Actions actions={actions} />
    </>
  )
}
