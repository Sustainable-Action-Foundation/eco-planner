"use client"

import type getRoadmaps from "@/fetchers/getRoadmaps"
import formSubmitter from "@/functions/formSubmitter"
import { ActionInput } from "@/types"
import { Action, ActionImpactType, DataSeries, Effect } from "@prisma/client"
import { useTranslation } from "react-i18next"
import DataSeriesInput from "../elements/dataSeriesInput/dataSeriesInput"
import { getDataSeries } from "../elements/dataSeriesInput/utils"
import styles from '../forms.module.css'
import TextEditor from "../elements/textEditor/editor"
import { useState } from "react"
import { Content } from "@tiptap/core"

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
  },
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [editorContent, setEditorContent] = useState<Content>(() => {
    if (!currentAction?.description) return null;

    try {
      return JSON.parse(currentAction.description) as Content;
    } catch {
      return currentAction.description;
    }
  });
  
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.target.elements

    // Get the data series as an array of numbers, the actual parsing is done by the API
    const dataSeries = getDataSeries(form);

    const formContent: ActionInput & { actionId: string | undefined, timestamp: number } = {
      name: (form.namedItem("actionName") as HTMLInputElement)?.value,
      description: JSON.stringify(editorContent),
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
      links: undefined, // TODO: Links in DB should be migrated to description
      timestamp,
    }

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST', t);
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
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.choose_relationship")}</legend>
            <label>
              {t("forms:action.relationship_label")}
              <select name="roadmapId" id="roadmapId" required className="block margin-top-25 margin-bottom-100 width-100" defaultValue={""}>
                <option value="" disabled>{t("forms:action.relationship_no_chosen")}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("common:count.action", { count: roadmap._count.actions })}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.action_description_legend")}</legend>
          <label>
            {t("forms:action.action_name")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="actionName" required id="actionName" defaultValue={currentAction?.name} />
          </label> 
          
          <label id="description-label">{t("forms:action.action_description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("common:tsx.write") + t("common:tsx.ellipsis")}
            editable={true}
            content={currentAction ? currentAction.description : ""}
            onChange={(json) => setEditorContent(json)}
          />

          <label>
            {t("forms:action.cost_efficiency")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="costEfficiency" id="costEfficiency" defaultValue={currentAction?.costEfficiency ?? undefined} />
          </label>

          <label>
            {t("forms:action.expected_outcome")}
            <textarea className="margin-top-25 margin-bottom-100" name="expectedOutcome" id="expectedOutcome" defaultValue={currentAction?.expectedOutcome ?? undefined} />
          </label>
        </fieldset>

        {(goalId && !currentAction) ?
          // TODO: Allow conversion between absolute and delta like in effectForm?
          <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:action.expected_effect_legend")}</legend>
            <label>
              {t("forms:action.impact_type_label")}
              <select name="impactType" id="impactType" className="block margin-top-25 margin-bottom-100 width-100" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
                <option value={ActionImpactType.ABSOLUTE}>{t("forms:action.impact_types.absolute")}</option>
                <option value={ActionImpactType.DELTA}>{t("forms:action.impact_types.delta")}</option>
                <option value={ActionImpactType.PERCENT}>{t("forms:action.impact_types.percent")}</option>
              </select>
            </label>

            <DataSeriesInput
              inputName="dataSeries"
              inputId="dataSeries"
              // TODO: Take in any string and use that as the label instead of a key to alleviate testing
              labelKey="forms:data_series_input.data_series"
            />
          </fieldset>
          : null
        }

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:action.action_years_legend")}</legend>
          <label>
            {t("forms:action.start_year")}
            <input className="margin-top-25 margin-bottom-100" type="number" name="startYear" id="startYear" defaultValue={currentAction?.startYear ?? undefined} min={2000} />
          </label>

          <label>
            {t("forms:action.end_year")}
            <input className="margin-top-25 margin-bottom-100" type="number" name="endYear" id="endYear" defaultValue={currentAction?.endYear ?? undefined} min={2000} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:action.describe_actors_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:action.project_manager")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="projectManager" id="projectManager" defaultValue={currentAction?.projectManager ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {t("forms:action.relevant_actors")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="relevantActors" id="relevantActors" defaultValue={currentAction?.relevantActors ?? undefined} />
          </label>
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:action.categories_legend")}</legend>
          <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50" htmlFor="isSufficiency">
            <input type="checkbox" name="isSufficiency" id="isSufficiency" defaultChecked={currentAction?.isSufficiency} />
            {t("forms:action.category_sufficiency")}
          </label>

          <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50" htmlFor="isEfficiency">
            <input type="checkbox" name="isEfficiency" id="isEfficiency" defaultChecked={currentAction?.isEfficiency} />
            {t("forms:action.category_efficiency")}
          </label>

          <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50" htmlFor="isRenewables">
            <input type="checkbox" name="isRenewables" id="isRenewables" defaultChecked={currentAction?.isRenewables} />
            {t("forms:action.category_renewables")}
          </label>
        </fieldset>

        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
          >
            {currentAction ? t("common:tsx.save") : t("common:tsx.create") + ` ${t("common:action_one")}`}
          </button>
        </div>
      </form>
    </>
  )
}