import getOneAction from "@/fetchers/getActions"
import styles from './page.module.css'
import Grid from "@/components/form/elements/grid/grid"
import ActionsGrid from "./actionsGrid"


// NOTE: Do we really want the entire page to be async?
export default async function Page() {
  const actions = await getOneAction()

  return (
    <>
      <h1>Åtgärder</h1>
      <ActionsGrid actions={actions} />
    </>
  )
}
