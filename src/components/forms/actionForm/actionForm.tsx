'use client'

import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"
import type getRoadmaps from "@/fetchers/getRoadmaps"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput } from "@/types"
import { Action, ActionImpactType, DataSeries, Effect } from "@prisma/client"
import { useTranslation } from "react-i18next"
import DataSeriesInput from "../dataSeriesInput/dataSeriesInput"
import { getDataSeries } from "../dataSeriesInput/utils"
import styles from '../forms.module.css'
// import DataSeriesInput from "../dataSeriesInput/dataSeriesInput"


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
  const { t } = useTranslation();

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target.elements

    const links = getLinks(event.target)

    // Get the data series as an array of numbers, the actual parsing is done by the API
    const dataSeries = getDataSeries(form);

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
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:action.choose_relationship")}</legend>
            <label className="block margin-block-100">
              {t("forms:action.relationship_label")}
              <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}>
                <option value="" disabled>{t("forms:action.relationship_no_chosen")}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("forms:action.action_count", { count: roadmap._count.actions })}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>{t("forms:action.action_description_legend")}</legend>
          <label className="block margin-block-100">
            {t("forms:action.action_name")}
            <input className="margin-block-25" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
          </label>

          <label className="block margin-block-100">
            {t("forms:action.action_description")}
            <textarea className="margin-block-25" name="actionDescription" id="actionDescription" defaultValue={currentAction?.description ?? undefined} ></textarea>
          </label>

          <label className="block margin-block-100">
            {t("forms:action.cost_efficiency")}
            <input className="margin-block-25" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {t("forms:action.expected_outcome")}
            <textarea className="margin-block-25" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
          </label>
        </fieldset>

        {(goalId && !currentAction) ?
          // TODO: Allow conversion between absolute and delta like in effectForm?
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:action.expected_effect_legend")}</legend>
            <label className="block margin-block-75">
              {t("forms:action.impact_type_label")}
              <select name="impactType" id="impactType" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
                <option value={ActionImpactType.ABSOLUTE}>{t("forms:action.impact_types.absolute")}</option>
                <option value={ActionImpactType.DELTA}>{t("forms:action.impact_types.delta")}</option>
                <option value={ActionImpactType.PERCENT}>{t("forms:action.impact_types.percent")}</option>
              </select>
            </label>

            <DataSeriesInput />
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:action.action_years_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:action.start_year")}
            <input className="margin-block-25" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
          </label>

          <label className="block margin-block-100">
            {t("forms:action.end_year")}
            <input className="margin-block-25" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:action.describe_actors_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:action.project_manager")}
            <input className="margin-block-25" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {t("forms:action.relevant_actors")}
            <input className="margin-block-25" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:action.categories_legend")}</legend>
          <label className="flex gap-25 align-items-center margin-bottom-50" htmlFor="isSufficiency">
            <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
            {t("forms:action.category_sufficiency")}
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isEfficiency">
            <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
            {t("forms:action.category_efficiency")}
          </label>

          <label className="flex gap-25 align-items-center margin-block-50" htmlFor="isRenewables">
            <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
            {t("forms:action.category_renewables")}
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:action.attach_external_resources")}</legend>
          <LinkInput links={currentAction?.links} />
        </fieldset>

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentAction ? t("common:tsx.save") : t("common:tsx.create")} />

      </form>
    </>
  )
}