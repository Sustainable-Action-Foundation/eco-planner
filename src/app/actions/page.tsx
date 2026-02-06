import getOneAction from "@/fetchers/getActions"


// NOTE: Do we really want the entire page to be async?
export default async function Page() {
  const actions = await getOneAction()

  return (
    <div>
      {actions?.map(action => (
        <div key={action.id}>
          {action.name}
        </div>
      ))}
    </div>
  )
}
