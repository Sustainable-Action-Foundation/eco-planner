'use client'

import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm"
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput, dataSeriesDataFieldNames } from "@/types"
import { Action, ActionImpactType, DataSeries } from "@prisma/client"
import { useState } from "react"

export default function ActionForm({
  goalId,
  currentAction
}: {
  goalId: string,
  currentAction?: Action & {
    dataSeries?: DataSeries | null,
    links: { url: string, description: string | null }[],
  },
}) {
  const [actionImpactType, setActionImpactType] = useState<ActionImpactType>(currentAction?.impactType || ActionImpactType.ABSOLUTE)

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target.elements

    const links = getLinks(event.target)

    // Convert the data series to an array of numbers, the actual parsing is done by the API
    const dataSeriesInput = (form.namedItem("dataSeries") as HTMLInputElement | null)?.value;
    const dataSeries = dataSeriesInput ? dataSeriesInput?.replaceAll(',', '.').split(/[\t;]/) : null;

    const formContent: ActionInput & { actionId: string | undefined, timestamp: number } = {
      name: (form.namedItem("actionName") as HTMLInputElement)?.value,
      description: (form.namedItem("actionDescription") as HTMLInputElement)?.value,
      costEfficiency: (form.namedItem("costEfficiency") as HTMLInputElement)?.value,
      expectedOutcome: (form.namedItem("expectedOutcome") as HTMLInputElement)?.value,
      impactType: (form.namedItem("impactType") as HTMLSelectElement)?.value as ActionImpactType | undefined,
      dataSeries: dataSeries,
      startYear: (form.namedItem("startYear") as HTMLInputElement)?.value ? parseInt((form.namedItem("startYear") as HTMLInputElement)?.value) : undefined,
      endYear: (form.namedItem("endYear") as HTMLInputElement)?.value ? parseInt((form.namedItem("endYear") as HTMLInputElement)?.value) : undefined,
      projectManager: (form.namedItem("projectManager") as HTMLInputElement)?.value,
      relevantActors: (form.namedItem("relevantActors") as HTMLInputElement)?.value,
      isSufficiency: (form.namedItem("isSufficiency") as HTMLInputElement)?.checked,
      isEfficiency: (form.namedItem("isEfficiency") as HTMLInputElement)?.checked,
      isRenewables: (form.namedItem("isRenewables") as HTMLInputElement)?.checked,
      goalId: goalId,
      actionId: currentAction?.id || undefined,
      links,
      timestamp,
    }

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST');
  }

  // If there is a data series, convert it to an array of numbers to use as a default value in the form
  const dataArray: (number | null)[] = []
  if (currentAction?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentAction.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  const timestamp = Date.now();

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <button type="submit" disabled={true} style={{ display: 'none' }} aria-hidden={true} />

        <label className="block margin-block-75">
          Namn på åtgärden:
          <input className="margin-block-25" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
        </label>

        <label className="block margin-block-75">
          Beskrivning av åtgärden:
          <textarea className="margin-block-25" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} ></textarea>
        </label>

        <label className="block margin-block-75">
          Kostnadseffektivitet:
          <input className="margin-block-25" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
        </label>

        <label className="block margin-block-75">
          Beskriv förväntat resultat:
          <textarea className="margin-block-25" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
        </label>

        <label className="block margin-block-75">
          Vilken typ av påverkan har åtgärden?
          <select name="impactType" id="impactType" defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)}>
            <option value={ActionImpactType.ABSOLUTE}>Absolut skillnad gentemot baslinje</option>
            <option value={ActionImpactType.DELTA}>Förändring år för år (delta)</option>
            <option value={ActionImpactType.PERCENT}>Skillnad gentemot baslinjen i procent av föregående års totalvärde (baslinje + åtgärder)</option>
          </select>
        </label>

        <details className="margin-block-75">
          <summary>
            Extra information om dataserie
          </summary>
          <p>
            Fältet &quot;Dataserie&quot; tar emot en serie värden separerade med semikolon eller tab, vilket innebär att du kan klistra in en serie värden från Excel eller liknande.<br />
            <strong>OBS: Värden får inte vara separerade med komma (&quot;,&quot;).</strong><br />
            Decimaltal kan använda antingen decimalpunkt eller decimalkomma.<br />
            Det första värdet representerar år 2020 och serien kan fortsätta maximalt till år 2050 (totalt 31 värden).<br />
            Om värden saknas för ett år kan du lämna det tomt, exempelvis kan &quot;;1;;;;5&quot; användas för att ange värdena 1 och 5 för år 2021 och 2025.
          </p>
        </details>

        <label className="block margin-block-75">
          Dataserie:
          {/* TODO: Make this allow .csv files and possibly excel files */}
          <input type="text" name="dataSeries" required id="dataSeries"
            pattern={dataSeriesPattern}
            title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
            className="margin-block-25"
            defaultValue={dataSeriesString}
          />
        </label>

        <label className="block margin-block-75">
          Planerat startår:
          <input className="margin-block-25" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
        </label>

        <label className="block margin-block-75">
          Planerat slutår:
          <input className="margin-block-25" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
        </label>

        <label className="block margin-block-75">
          Projektansvarig:
          <input className="margin-block-25" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
        </label>

        <label className="block margin-block-75">
          Relevanta aktörer:
          <input className="margin-block-25" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
        </label>

        <p>Vilka kategorier faller åtgärden under?</p>
        <div className="display-flex gap-25 align-items-center margin-block-50">
          <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
          <label htmlFor="isSufficiency">Sufficiency</label>
        </div>
        <div className="display-flex gap-25 align-items-center margin-block-50">
          <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
          <label htmlFor="isEfficiency">Efficiency</label>
        </div>
        <div className="display-flex gap-25 align-items-center margin-block-50">
          <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
          <label htmlFor="isRenewables">Renewables</label>
        </div>

        <div className="margin-block-300">
          <LinkInput links={currentAction?.links} />
        </div>

        <input type="submit" className="margin-block-75 seagreen color-purewhite" value={currentAction ? "Spara" : "Skapa åtgärd"} />

      </form>
    </>
  )
}