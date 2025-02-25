'use client'

import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm"
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import type getRoadmaps from "@/fetchers/getRoadmaps"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput } from "@/types"
import { Action, ActionImpactType, DataSeries, Effect } from "@prisma/client"
import styles from '../forms.module.css'
import dict from "./actionForm.dict.json" assert { type: "json" };
import { useClientLocale } from "@/functions/clientLocale"

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
  const locale = useClientLocale();

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

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* This hidden submit button prevents submitting by pressing enter, this avoids accidental submission when adding new entries in AccessSelector (for example, when pressing enter to add someone to the list of editors) */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {!(roadmapId || currentAction?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{dict.fieldset[0].enterRelation[locale]}</legend>
            <label className="block margin-block-100">
              {dict.fieldset[0].selectRoadmapVersion[locale]}:
              <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}>
                <option value="" disabled>{dict.fieldset[0].selectRoadmapVersion.options.selectRoadmapVersion[locale]}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} ${dict.fieldset[0].selectRoadmapVersion.options.actions[locale]}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>{dict.fieldset[1].describeAction[locale]}</legend>
          <label className="block margin-block-100">
            {dict.fieldset[1].descriptionElements.nameOfAction[locale]}
            <input className="margin-block-25" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
          </label>

          <label className="block margin-block-100">
            {dict.fieldset[1].descriptionElements.descriptionOfAction[locale]}
            <textarea className="margin-block-25" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} ></textarea>
          </label>

          <label className="block margin-block-100">
            {dict.fieldset[1].descriptionElements.costEfficiency[locale]}
            <input className="margin-block-25" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {dict.fieldset[1].descriptionElements.expectedResult[locale]}
            <textarea className="margin-block-25" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
          </label>
        </fieldset>

        {(goalId && !currentAction) ?
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.fieldset[2].enterExpectedEffect[locale]}</legend>
            <label className="block margin-block-75">
              {dict.fieldset[2].typeOfEffect[locale]}
              <select name="impactType" id="impactType" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
                <option value={ActionImpactType.ABSOLUTE}>{dict.fieldset[2].typeOfEffect.options.absolute[locale]}</option>
                <option value={ActionImpactType.DELTA}>{dict.fieldset[2].typeOfEffect.options.delta[locale]}</option>
                <option value={ActionImpactType.PERCENT}>{dict.fieldset[2].typeOfEffect.options.percent[locale]}</option>
              </select>
            </label>

            <details className="margin-block-75">
              <summary>
                {dict.fieldset[2].extraInfo[locale]}
              </summary>
              <p>
                {dict.fieldset[2].extraInfo.info[locale]}
              </p>
            </details>

            <label className="block margin-block-75">
              {dict.fieldset[2].dataSeries[locale]}:
              {/* TODO: Make this allow .csv files and possibly excel files */}
              <input type="text" name="dataSeries" required id="dataSeries"
                pattern={dataSeriesPattern}
                title={dict.fieldset[2].dataSeries.input.title[locale]}
                className="margin-block-25"
              // defaultValue={dataSeriesString}
              />
            </label>
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.fieldset[3].chooseYears[locale]}</legend>
          <label className="block margin-bottom-100">
            {dict.fieldset[3].startingYear[locale]}
            <input className="margin-block-25" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
          </label>

          <label className="block margin-block-100">
            {dict.fieldset[3].endingYear[locale]}
            <input className="margin-block-25" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.fieldset[4].describeActors[locale]}</legend>
          <label className="block margin-bottom-100">
            {dict.fieldset[4].projectManager[locale]}
            <input className="margin-block-25" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {dict.fieldset[4].relevantActors[locale]}
            <input className="margin-block-25" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.fieldset[5].chooseCategories[locale]}</legend>
          <label className="flex gap-25 align-items-center margin-bottom-50" htmlFor="isSufficiency">
            <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
            {dict.fieldset[5].categories.options.sufficiency[locale]}
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isEfficiency">
            <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
            {dict.fieldset[5].categories.options.efficiency[locale]}
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isRenewables">
            <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
            {dict.fieldset[5].categories.options.renewables[locale]}
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.fieldset[6].externalResources[locale]}</legend>
          <LinkInput links={currentAction?.links} />
        </fieldset>

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentAction ? `${dict.submit.save[locale]}` : `${dict.submit.create[locale]}`} />

      </form>
    </>
  )
}