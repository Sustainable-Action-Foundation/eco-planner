'use client'

import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm"
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput } from "@/types"
import { Action, ActionImpactType, DataSeries, Effect } from "@prisma/client"
import type getRoadmaps from "@/fetchers/getRoadmaps"
import styles from '../forms.module.css'


export default function ActionForm({
  roadmapId,
  roadmapAlternatives,
  goalId,
  currentAction,
}: {
  roadmapId?: string,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  goalId?: string,
  currentAction?: Action & {
    effects: (Effect & {
      dataSeries?: DataSeries | null,
    })[],
    links: { url: string, description: string | null }[],
  },
}) {
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target.elements

    const links = getLinks(event.target)

    // Convert the data series to an array of numbers, the actual parsing is done by the API
    const dataSeriesInput = (form.namedItem("dataSeries") as HTMLInputElement | null)?.value;
    const dataSeries = dataSeriesInput ? dataSeriesInput?.replaceAll(',', '.').split(/[\t;]/) : undefined;

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
      roadmapId: (form.namedItem("roadmapId") as HTMLInputElement)?.value || roadmapId,
      goalId: goalId,
      actionId: currentAction?.id || undefined,
      links,
      timestamp,
    }

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST');
  }

  const timestamp = Date.now();

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {!(roadmapId || currentAction?.roadmapId) ?
          <label className="block margin-block-300">
            Välj färdplanversion att skapa åtgärden under:
            <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}>
              <option value="" disabled>Välj färdplansversion</option>
              {roadmapAlternatives.map(roadmap => (
                <option key={roadmap.id} value={roadmap.id}>
                  {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} åtgärder`}
                </option>
              ))}
            </select>
          </label>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position='1' className={`${styles.timeLineLegend}  font-weight-bold`}>Beskriv din åtgärd</legend>
          <label className="block margin-block-100">
            Namn på åtgärden
            <input className="margin-block-25" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
          </label>

          <label className="block margin-block-100">
            Beskrivning av åtgärden
            <textarea className="margin-block-25" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} ></textarea>
          </label>

          <label className="block margin-block-100">
            Kostnadseffektivitet
            <input className="margin-block-25" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
          </label>

          <label className="block margin-block-100">
            Förväntat resultat
            <textarea className="margin-block-25" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
          </label>
        </fieldset>

        {/* TODO: Work out fieldset interaction for this */}
        {(goalId && !currentAction) ?
          <>
            <label className="block margin-block-75">
              Vilken typ av påverkan har åtgärden?
              <select name="impactType" id="impactType" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
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
              // defaultValue={dataSeriesString}
              />
            </label>
          </>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position='2' className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Välj pågående år för din åtgärd</legend>
          <label className="block margin-bottom-100">
            Startår
            <input className="margin-block-25" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
          </label>

          <label className="block margin-block-100">
            Slutår
            <input className="margin-block-25" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position='3' className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Beskriv aktörer för din åtgärd</legend>
          <label className="block margin-bottom-100">
            Projektansvarig
            <input className="margin-block-25" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
          </label>

          <label className="block margin-block-100">
            Relevanta aktörer
            <input className="margin-block-25" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position='4' className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Vilka kategorier faller åtgärden under?</legend>
          <label className="flex gap-25 align-items-center margin-bottom-50" htmlFor="isSufficiency">
            <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
            Sufficiency
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isEfficiency">
            <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
            Efficiency
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isRenewables">
            <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
            Renewables
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position='4' className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>Bifoga externa resurser</legend>
            <LinkInput links={currentAction?.links} />
          </fieldset>

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentAction ? "Spara" : "Skapa åtgärd"} />

      </form>
    </>
  )
}