'use client'

import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter"
import { Action } from "@prisma/client"

export default function ActionForm({
  roadmapId,
  goalId,
  currentAction
}: {
  roadmapId: string,
  goalId: string,
  currentAction?: Action & {
    links: { url: string, description: string | null }[],
  },
}) {
  // Submit the form to the API
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target.elements

    const links = getLinks(event.target)

    const formJSON = JSON.stringify({
      name: (form.namedItem("actionName") as HTMLInputElement)?.value,
      description: (form.namedItem("actionDescription") as HTMLInputElement)?.value,
      costEfficiency: (form.namedItem("costEfficiency") as HTMLInputElement)?.value,
      expectedOutcome: (form.namedItem("expectedOutcome") as HTMLInputElement)?.value,
      startYear: (form.namedItem("startYear") as HTMLInputElement)?.value ? parseInt((form.namedItem("startYear") as HTMLInputElement)?.value) : undefined,
      endYear: (form.namedItem("endYear") as HTMLInputElement)?.value ? parseInt((form.namedItem("endYear") as HTMLInputElement)?.value) : undefined,
      projectManager: (form.namedItem("projectManager") as HTMLInputElement)?.value,
      relevantActors: (form.namedItem("relevantActors") as HTMLInputElement)?.value,
      isSufficiency: (form.namedItem("isSufficiency") as HTMLInputElement)?.checked,
      isEfficiency: (form.namedItem("isEfficiency") as HTMLInputElement)?.checked,
      isRenewables: (form.namedItem("isRenewables") as HTMLInputElement)?.checked,
      goalId: goalId,
      actionId: currentAction?.id || null,
      links,
      timestamp,
    })

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST');
  }

  const timestamp = Date.now();

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <button type="submit" disabled={true} style={{ display: 'none' }} aria-hidden={true} />
        <div>
          <label htmlFor="actionName">Namn på åtgärden: </label>
          <input type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
        </div>
        <div>
          <label htmlFor="actionDescription">Beskrivning av åtgärden: </label>
          <input type="text" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} />
        </div>
        <label htmlFor="costEfficiency">Kostnadseffektivitet: </label>
        <input type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
        <label htmlFor="expectedOutcome">Förväntat resultat: </label>
        <input type="text" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
        <div>
          <label htmlFor="startYear">Planerat startår: </label>
          <input type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
        </div>
        <div>
          <label htmlFor="endYear">Planerat slutår: </label>
          <input type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
        </div>
        <label htmlFor="projectManager">Projektansvarig: </label>
        <input type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
        <label htmlFor="relevantActors">Relevanta aktörer: </label>
        <input type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
        <p>Vilka kategorier faller åtgärden under?</p>
        <div className="display-flex gap-25 align-items-center">
          <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
          <label htmlFor="isSufficiency">Sufficiency</label>
        </div>
        <div className="display-flex gap-25 align-items-center">
          <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
          <label htmlFor="isEfficiency">Efficiency</label>
        </div>
        <div className="display-flex gap-25 align-items-center">
          <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
          <label htmlFor="isRenewables">Renewables</label>
        </div>
        <div>
          <LinkInput links={currentAction?.links} />
        </div>
        <input type="submit" value={currentAction ? "Spara" : "Skapa åtgärd"} />
      </form>
    </>
  )
}