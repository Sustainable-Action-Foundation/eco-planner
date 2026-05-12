"use client";

import formSubmitter from "@/functions/formSubmitter";
import type { Action, ActionInput, DateValuesWithUnit, MultiRoadmapInstance } from "@/types";
import { isDateValuesWithUnit } from "@/types";
import { ActionImpactType } from "@/lib/prisma/generated";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import TextEditor from "../elements/textEditor/editor";
import DataSeriesInputManual from "../elements/dataSeriesInput/dataSeriesInputManual";
import { useState, useRef } from "react";
import { useToastContext } from "@/components/generic/toast/toastContext";
import { useRouter } from "next/navigation";

export default function ActionForm({
  goalId,
  roadmapId,
  currentAction,
  roadmaps,
}: {
  goalId?: string,
  roadmapId?: string,
  currentAction?: Action,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [timestamp] = useState(() => Date.now());
  const descriptionRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { addToast } = useToastContext();

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    // TODO: Use formData instead of DOM traversal
    const form = event.target.elements;

    let startYear: number | undefined = parseInt((form.namedItem("startYear") as HTMLInputElement).value, 10);
    let endYear: number | undefined = parseInt((form.namedItem("endYear") as HTMLInputElement).value, 10);

    if (!Number.isFinite(startYear)) {
      startYear = undefined;
    }
    if (!Number.isFinite(endYear)) {
      endYear = undefined;
    }

    let dataSeries: DateValuesWithUnit | undefined;
    try {
      const rawDataSeries = JSON.parse((form.namedItem("data-series") as HTMLInputElement)?.value) as unknown;
      if (rawDataSeries && isDateValuesWithUnit(rawDataSeries)) {
        dataSeries = rawDataSeries;
      }
    } catch {
      event.target.reportValidity();
      addToast(t("common:errors.something_went_wrong"), "error");
      console.error("Failed to parse data series, invalid JSON or incorrect format.");
      return;
    }

    const formContent: ActionInput = {
      actionId: currentAction ? currentAction.id : undefined,
      roadmapId: roadmapId ?? (form.namedItem("roadmapId") as HTMLInputElement)?.value ?? undefined,
      goalId: goalId ?? undefined,
      description: (form.namedItem("description") as HTMLInputElement | null)?.value ?? undefined,
      name: (form.namedItem("actionName") as HTMLInputElement)?.value ?? "",
      startYear,
      endYear,
      costEfficiency: (form.namedItem("costEfficiency") as HTMLInputElement)?.value ?? undefined,
      expectedOutcome: (form.namedItem("expectedOutcome") as HTMLInputElement)?.value ?? undefined,
      projectManager: (form.namedItem("projectManager") as HTMLInputElement)?.value ?? undefined,
      relevantActors: (form.namedItem("relevantActors") as HTMLInputElement)?.value ?? undefined,
      isSufficiency: (form.namedItem("isSufficiency") as HTMLInputElement)?.checked ?? false,
      isEfficiency: (form.namedItem("isEfficiency") as HTMLInputElement)?.checked ?? false,
      isRenewables: (form.namedItem("isRenewables") as HTMLInputElement)?.checked ?? false,
      parentAction: currentAction ?? undefined,
      childActions: undefined,
      dataSeries,
      impactType: goalId && !currentAction
        ? (form.namedItem("impactType") as HTMLInputElement)?.value as ActionImpactType
        : undefined,
      links: undefined,
      timestamp,
    };

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST', t, undefined, undefined, undefined, undefined, addToast, router.push);
  }

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
                {roadmaps.map(roadmap => (
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
            className="margin-top-25 margin-bottom-100" // TODO: Need label for textEditorMenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("forms:text_editor_menu.default_placeholder")}
            editable={true}
            content={currentAction ? currentAction.description : ""}
            onChange={(json) => descriptionRef.current ? descriptionRef.current.value = JSON.stringify(json) : null}
          />
          <input ref={descriptionRef} type="hidden" name="description" defaultValue={currentAction?.description ?? ""} />

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

            <DataSeriesInputManual
              id="action-dataseries"
              label={t("forms:data_series_input.data_series")}
              outputFormElement={<input name="data-series" />}
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
          <legend
            // Technically incrementing here is unused but if you add a another entry after this one it will be correct
            // eslint-disable-next-line no-useless-assignment
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:action.categories_legend")}
          </legend>
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
            {currentAction ? t("common:tsx.save") : t("forms:action.create")}
          </button>
        </div>
      </form>
    </>
  );
}