"use client";

import { ActionFieldHeaders, actionFieldLabel } from "@/functions/actionFields";
import formSubmitter from "@/functions/formSubmitter";
import type { Action, ActionInput, DateValuesWithUnit, MultiRoadmapInstance } from "@/types";
import { ActionFormName } from "@/types/form-names";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { ActionImpactType } from "@/lib/prisma/generated";
import { useTranslation } from "react-i18next";
import styles from '../forms.module.css';
import { FormSync, ManualDataSeriesInput, RecipeContextProvider } from "@/components/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { useState } from "react";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { UnitFlags } from "@/types/enums";

export default function ActionForm({
  goalId,
  iterationId,
  currentAction,
  roadmaps,
}: {
  goalId?: string,
  /** The roadmap iteration the action belongs to, if preselected */
  iterationId?: string,
  currentAction?: Action,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [timestamp] = useState(() => Date.now());
  const router = useRouter();

  const { addToast } = useToast();

  // Free-form descriptive fields, replacing the old fixed columns. New actions are
  // seeded with the canonical machine-key headers (the same ones the migration used
  // for old data); the UI translates known keys for display.
  const [fields, setFields] = useState<{ header: string, value: string }[]>(() =>
    currentAction
      ? currentAction.fields.map(field => ({ header: field.header, value: field.value }))
      : [
        { header: ActionFieldHeaders.Description, value: "" },
        { header: ActionFieldHeaders.CostEfficiency, value: "" },
        { header: ActionFieldHeaders.ExpectedOutcome, value: "" },
        { header: ActionFieldHeaders.RelevantActors, value: "" },
      ],
  );

  function updateField(index: number, patch: Partial<{ header: string, value: string }>) {
    setFields(previous => previous.map((field, i) => i === index ? { ...field, ...patch } : field));
  }

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    // TODO: Use formData instead of DOM traversal
    const form = event.target.elements;

    let startYear: number | undefined = parseInt((form.namedItem(ActionFormName.StartYear) as HTMLInputElement).value, 10);
    let endYear: number | undefined = parseInt((form.namedItem(ActionFormName.EndYear) as HTMLInputElement).value, 10);

    if (!Number.isFinite(startYear)) {
      startYear = undefined;
    }
    if (!Number.isFinite(endYear)) {
      endYear = undefined;
    }

    let dataSeries: DateValuesWithUnit | undefined;
    try {
      const rawDataSeries = JSON.parse((form.namedItem(ActionFormName.ResultingDateValues) as HTMLInputElement)?.value) as unknown;
      if (rawDataSeries && isDateValuesWithUnit(rawDataSeries)) {
        dataSeries = rawDataSeries;
      }
    } catch {
      if (!goalId) {
        // If there is no goalId, no data series should be submitted.
        dataSeries = undefined;
      } else {
        event.target.reportValidity();
        addToast(t("common:errors.something_went_wrong"), "error");
        console.error("Failed to parse data series, invalid JSON or incorrect format.");
        return;
      }
    }

    const formContent: ActionInput = {
      actionId: currentAction ? currentAction.id : undefined,
      iterationId: iterationId ?? (form.namedItem(ActionFormName.RoadmapId) as HTMLInputElement)?.value ?? undefined,
      orgId: undefined, // Derived from the iteration's roadmap
      goalId: goalId ?? undefined,
      name: (form.namedItem(ActionFormName.ActionName) as HTMLInputElement)?.value ?? "",
      indicatorParameter: currentAction?.indicator_parameter ?? undefined, // Falls back to the name server-side
      startYear,
      endYear,
      // Empty rows carry no data; drop them rather than storing blank fields.
      fields: fields.filter(field => field.header.trim() !== "" && field.value.trim() !== ""),
      parentActionId: currentAction?.parent_action_id ?? undefined,
      dataSeries,
      impactType: goalId && !currentAction
        ? (form.namedItem(ActionFormName.ImpactType) as HTMLInputElement)?.value as ActionImpactType
        : undefined,
      timestamp,
    };

    const formJSON = JSON.stringify(formContent);

    formSubmitter('/api/action', formJSON, currentAction ? 'PUT' : 'POST', t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

  return (
    <form onSubmit={handleSubmit}>
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      {!(iterationId || currentAction?.roadmap_iteration_id) ?
        <fieldset className={`${styles.timeLineFieldset} width-100`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-125`}>{t("forms:action.choose_relationship")}</legend>
          <label>
            {t("forms:action.relationship_label")}
            <select name={ActionFormName.RoadmapId} id="iterationId" required={true} className="block margin-top-25 margin-bottom-100 width-100" defaultValue={""}>
              <option value="" disabled={true}>{t("forms:action.relationship_no_chosen")}</option>
              {roadmaps.map(iteration => (
                <option key={iteration.id} value={iteration.id}>
                  {`${iteration.roadmap.name} (v${iteration.version}): ${t("common:count.action", { count: iteration._count.actions })}`}
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
          <input className="margin-top-25 margin-bottom-100" type="text" name={ActionFormName.ActionName} required={true} id="actionName" defaultValue={currentAction?.name} />
        </label>

        {/* Repeatable free-form fields, replacing the old fixed inputs
            (description, cost efficiency, expected outcome, project manager, relevant actors...) */}
        {fields.map((field, index) => (
          <fieldset key={index} className="margin-bottom-100 fieldset-unset-pseudo-class">
            <label>
              {t("forms:action.field_header")}
              <input
                className="margin-top-25 margin-bottom-100"
                type="text"
                value={field.header}
                onChange={(event) => updateField(index, { header: event.target.value })}
              />
            </label>
            <label>
              {actionFieldLabel(field.header, t) === field.header ? t("forms:data_series_input.value") : actionFieldLabel(field.header, t)}
              <textarea
                className="margin-top-25 margin-bottom-100"
                value={field.value}
                onChange={(event) => updateField(index, { value: event.target.value })}
              />
            </label>
            <button
              type="button"
              onClick={() => setFields(previous => previous.filter((_, i) => i !== index))}
            >
              {t("common:tsx.delete")}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="margin-top-100"
          onClick={() => setFields(previous => [...previous, { header: "", value: "" }])}
        >
          {t("forms:data_series_input.add_new_row")}
        </button>
      </fieldset>

      {(goalId && !currentAction) ?
        // TODO: Allow conversion between absolute and delta like in effectForm?
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:action.expected_effect_legend")}</legend>
          <label>
            {t("forms:action.impact_type_label")}
            <select name={ActionFormName.ImpactType} id="impactType" className="block margin-top-25 margin-bottom-100 width-100" /* defaultValue={actionImpactType} onChange={e => setActionImpactType(e.target.value as ActionImpactType)} */ >
              <option value={ActionImpactType.ABSOLUTE}>{t("forms:action.impact_types.absolute")}</option>
              <option value={ActionImpactType.DELTA}>{t("forms:action.impact_types.delta")}</option>
              <option value={ActionImpactType.PERCENT}>{t("forms:action.impact_types.percent")}</option>
            </select>
          </label>

          <RecipeContextProvider
            initialRecipe={Recipe.fromManualDateValues({ unit: UnitFlags.Missing, dateValues: {} }).serialize()}
          >
            <ManualDataSeriesInput
              id="action-dataseries"
              label={t("forms:data_series_input.data_series")}
            />
            <FormSync DateValuesFormElement={<input name={ActionFormName.ResultingDateValues} />} />
          </RecipeContextProvider>
        </fieldset>
        : null
      }

      <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
        <legend
          // Technically incrementing here is unused but if you add a another entry after this one it will be correct
          // eslint-disable-next-line no-useless-assignment
          data-position={positionIndex++}
          className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
        >
          {t("forms:action.action_years_legend")}
        </legend>
        <label>
          {t("forms:action.start_year")}
          <input className="margin-top-25 margin-bottom-100" type="number" name={ActionFormName.StartYear} id="startYear" defaultValue={currentAction?.start_year ?? undefined} min={2000} />
        </label>

        <label>
          {t("forms:action.end_year")}
          <input className="margin-top-25 margin-bottom-100" type="number" name={ActionFormName.EndYear} id="endYear" defaultValue={currentAction?.end_year ?? undefined} min={2000} />
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
  );
}
