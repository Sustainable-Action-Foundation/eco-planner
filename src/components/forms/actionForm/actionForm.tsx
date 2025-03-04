'use client'

import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm"
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import type getRoadmaps from "@/fetchers/getRoadmaps"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput } from "@/types"
import { Action, ActionImpactType, DataSeries, Effect } from "@prisma/client"
import styles from '../forms.module.css'
import { createDict } from "../forms.dict.ts";
import { LocaleContext } from "@/app/context/localeContext.tsx"
import { useContext } from "react"

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
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).actionForm.actionForm;

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

        {/* Relationship to other roadmaps */}
        {!(roadmapId || currentAction?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            {/* Title */}
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{dict.selectRoadmapSection.title}</legend>

            {/* Dropdown */}
            <label className="block margin-block-100">
              {dict.selectRoadmapSection.enterRelation}:
              <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}>
                <option value="" disabled>{dict.selectRoadmapSection.selectRoadmapVersionDropdown.placeholder}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {/* Roadmap (vNNN): NN actions */}
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${roadmap._count.actions} ${dict.selectRoadmapSection.selectRoadmapVersionDropdown.actions}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        {/* Describe action */}
        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          {/* Title */}
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>{dict.descriptionSection.title}</legend>

          {/* Name of action */}
          <label className="block margin-block-100">
            {dict.descriptionSection.nameOfAction}
            <input className="margin-block-25" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
          </label>

          {/* Description of action */}
          <label className="block margin-block-100">
            {dict.descriptionSection.descriptionOfAction}
            <textarea className="margin-block-25" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} ></textarea>
          </label>

          {/* Cost efficiency */}
          <label className="block margin-block-100">
            {dict.descriptionSection.costEfficiency}
            <input className="margin-block-25" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
          </label>

          {/* Expected result */}
          <label className="block margin-block-100">
            {dict.descriptionSection.expectedResult}
            <textarea className="margin-block-25" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
          </label>
        </fieldset>

        {/* Expected impact of action */}
        {(goalId && !currentAction) ?
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            {/* Title */}
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.expectedImpactSection.title}</legend>

            {/* Impact type */}
            <label className="block margin-block-75">
              {dict.expectedImpactSection.title}
              <select name="impactType" id="impactType" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
                <option value={ActionImpactType.ABSOLUTE}>{dict.expectedImpactSection.type.absolute}</option>
                <option value={ActionImpactType.DELTA}>{dict.expectedImpactSection.type.delta}</option>
                <option value={ActionImpactType.PERCENT}>{dict.expectedImpactSection.type.percent}</option>
              </select>
            </label>

            {/* Data series dropdown */}
            <details className="margin-block-75">
              <summary>
                {dict.expectedImpactSection.dataSeries.dropdown.title}
              </summary>
              <p>
                {dict.expectedImpactSection.dataSeries.dropdown.info}
              </p>
            </details>

            {/* Data series */}
            <label className="block margin-block-75">
              {dict.expectedImpactSection.dataSeries.title}:
              {/* TODO: Make this allow .csv files and possibly excel files */}
              <input type="text" name="dataSeries" required id="dataSeries"
                pattern={dataSeriesPattern}
                title={dict.expectedImpactSection.dataSeries.hoverText}
                className="margin-block-25"
              // defaultValue={dataSeriesString}
              />
            </label>
          </fieldset>
          : null
        }

        {/* Starting year */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          {/* Title */}
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.startingYearSection.title}</legend>

          {/* Starting year */}
          <label className="block margin-bottom-100">
            {dict.startingYearSection.startingYear}
            <input className="margin-block-25" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
          </label>

          {/* Ending year */}
          <label className="block margin-block-100">
            {dict.startingYearSection.endingYear}
            <input className="margin-block-25" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
          </label>
        </fieldset>

        {/* Describe actors */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          {/* Title */}
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.actorsSection.title}</legend>

          {/* Project manager */}
          <label className="block margin-bottom-100">
            {dict.actorsSection.projectManager}
            <input className="margin-block-25" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
          </label>

          {/* Relevant actors */}
          <label className="block margin-block-100">
            {dict.actorsSection.relevantActors}
            <input className="margin-block-25" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
          </label>
        </fieldset>

        {/* Categories */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          {/* Title */}
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.categoriesSection.title}</legend>

          {/* Sufficiency */}
          <label className="flex gap-25 align-items-center margin-bottom-50" htmlFor="isSufficiency">
            <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
            {dict.categoriesSection.sufficiency}
          </label>

          {/* Efficiency */}
          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isEfficiency">
            <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
            {dict.categoriesSection.efficiency}
          </label>

          {/* Renewables */}
          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isRenewables">
            <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
            {dict.categoriesSection.renewables}
          </label>
        </fieldset>

        {/* Attach external resources */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          {/* Title */}
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{dict.externalResourcesSection.title}</legend>

          {/* Links */}
          <LinkInput links={currentAction?.links} />
        </fieldset>

        {/* Submit */}
        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentAction ? `${dict.submitSection.save}` : `${dict.submitSection.create}`} />

      </form>
    </>
  )
}