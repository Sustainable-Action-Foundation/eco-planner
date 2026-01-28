'use client';

import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import formSubmitter from "@/functions/formSubmitter";
import { DateValuesWithUnit, GoalCreateInput, GoalUpdateInput } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DateValuesInput from "../elements/dataSeriesInput/dateValuesInput";
import styles from '../forms.module.css';
import { InheritingBaseline, ManualGoalForm } from "../sections/goalFormSections";
import { RecipeContextProvider } from "@/components/recipe/context/recipeContext.provider";
import { Recipe } from "@/functions/recipe/types";
import { recipeFromUnknown } from "@/functions/recipe/parseRecipe";
import TextEditor from "../elements/textEditor/editor";
import { Content } from "@tiptap/core";
import SuggestedRecipeToggle from "@/components/recipe/suggestions/suggestedRecipeToggle";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import FormIntegration from "@/components/recipe/editor/output/formIntegration";

const DataSeriesType = {
  Static: "STATIC",
  Inherited: "INHERIT",
  Combined: "COMBINE",
} as const;
type DataSeriesType = (typeof DataSeriesType)[keyof typeof DataSeriesType];

const BaselineType = {
  Initial: "INITIAL",
  Custom: "CUSTOM",
  Inherited: "INHERIT",
} as const;
type BaselineType = (typeof BaselineType)[keyof typeof BaselineType];

export default function GoalForm({
  roadmapId,
  roadmapAlternatives,
  currentGoal,
}: {
  roadmapId?: string,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  currentGoal?: Goal & {
    dataSeries: DataSeries | null,
    baselineDataSeries: DataSeries | null,
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(DataSeriesType.Inherited);
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baselineDataSeries ? BaselineType.Custom : BaselineType.Initial);
  const [editorContent, setEditorContent] = useState<Content>(() => {
    if (!currentGoal?.description) return null;

    try {
      return JSON.parse(currentGoal.description) as Content;
    } catch {
      return currentGoal.description;
    }
  });
  const [parentRoadmapId, setParentRoadmapId] = useState<string>(roadmapId || "")

  const parentRoadmaps = useMemo(() => {
    return (roadmapAlternatives ?? []).map(roadmap => ({
      name: t("common:roadmap_version_name", { name: roadmap.metaRoadmap.name, version: roadmap.version }),
      value: roadmap.id
    }));
  }, [roadmapAlternatives, t]);

  const timestamp = useMemo(() => Date.now(), []);

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);
    // List of inputs expecting a file
    const fileInputKeys: string[] = [];

    // Basic validation to ensure no unexpected File objects are present
    // Allows us to safely cast all formData values to (string | null) later
    if (formData.entries().some(([key, value]) => value instanceof File && !fileInputKeys.includes(key))) {
      console.error("Form data contains an unexpected File object.");
      event.target.reportValidity();
      return;
    }

    const resultingRecipeString = formData.get("resultingRecipe") as string | null;
    const resultingDateValuesString = formData.get("resultingDateValues") as string | null;

    // Parse recipe if present
    let parsedRecipe: Recipe | undefined = undefined;
    if (resultingRecipeString) {
      try {
        parsedRecipe = recipeFromUnknown(resultingRecipeString);
      } catch (e) {
        console.error("Failed to parse resulting recipe from form:", e);
        event.target.reportValidity();
        return;
      }
    }
    // Parse date values if present
    let parsedDateValues: DateValuesWithUnit | undefined = undefined;
    if (resultingDateValuesString) {
      try {
        parsedDateValues = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
      } catch (e) {
        console.error("Failed to parse resulting date values from form:", e);
        event.target.reportValidity();
        return;
      }
    }

    // Build the JSON payload for the API
    let formContent: GoalCreateInput | GoalUpdateInput;
    if (currentGoal) {
      formContent = {
        goalId: currentGoal.id,
        timestamp: timestamp, // Only needed for edits

        name: formData.get("goalName") as string | null || undefined,
        description: JSON.stringify(editorContent),
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? undefined,
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked ?? undefined,
        recipeSuggestions: undefined, // TODO: add recipe suggestions input

        externalDataset: undefined,
        externalTableId: undefined,
        externalSelection: undefined,

        dataSeriesId: undefined,
        dataSeries: parsedDateValues,
        dataSeriesRecipe: parsedRecipe,

        baselineId: undefined,
        baseline: undefined,
        baselineRecipe: undefined,

        roadmapId: undefined, // Can't reassign the roadmap of an existing goal
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      }
    } else {
      formContent = {
        goalId: undefined, // Ignored when creating
        timestamp: undefined, // Ignored when creating

        name: formData.get("goalName") as string | null || null,
        description: JSON.stringify(editorContent),
        indicatorParameter: formData.get("indicatorParameter") as string | null ?? (event.target.reportValidity(), ""),
        isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked || false,
        recipeSuggestions: undefined, // TODO: add recipe suggestions input

        // Goals are currently created without historical data (external data), but the API can handle it if we change this later
        externalDataset: null,
        externalTableId: null,
        externalSelection: null,

        dataSeriesId: null,
        dataSeries: parsedDateValues,
        dataSeriesRecipe: parsedRecipe,

        baselineId: null,
        baseline: null,
        baselineRecipe: null,

        roadmapId: roadmapId || parentRoadmapId,
        rawTags: undefined, // TODO: add tags input

        // DEPRECATED - moved to description
        links: undefined,
      }
    }

    const formJSON = JSON.stringify(formContent);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST', t);
  }

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  return (
    <>
      <form onSubmit={handleSubmit} name="goalForm">
        {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* Allow user to select parent roadmap if not already selected */}
        {!(roadmapId || currentGoal?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_relationship")}</legend>
            <label htmlFor="parent-roadmap">{t("forms:goal.relationship_label")}</label>
            <SelectSingleSearch
              props={{
                required: true,
                className: "margin-top-25 margin-bottom-100",
                id: "parent-roadmap",
                name: "parent-roadmap",
                placeholder: `${t("common:tsx.select")}  ${t("common:roadmap_series_one")}`,
              }}
              onChange={(value) => value?.value ? setParentRoadmapId(value.value) : setParentRoadmapId("")}
              options={parentRoadmaps}
            />
          </fieldset>
          : null
        }

        {/* Goal name and description */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.goal_description_legend")}</legend>
          <label>
            {t("forms:goal.goal_name")}
            <input className="margin-top-25 margin-bottom-100" type="text" name="goalName" id="goalName" defaultValue={currentGoal?.name ?? undefined} />
          </label>

          <label id="description-label">{t("forms:goal.goal_description")}</label>
          <TextEditor
            className="margin-top-25 margin-bottom-100" // TODO: Need label for texteditormenu
            id="description"
            ariaLabelledBy="description-label"
            placeholder={t("forms:text_editor_menu.default_placeholder")}
            editable={true}
            content={currentGoal ? currentGoal.description : ""}
            onChange={(json) => setEditorContent(json)}
          />
        </fieldset>

        {/* Data series input section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_goal_data_series")}</legend>
          <div>
            <label className="flex width-fit-content margin-bottom-75 align-items-center gap-50">
              <input
                checked={dataSeriesType === DataSeriesType.Static}
                onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
                value={DataSeriesType.Static}
                type="radio"
                name="alternative"
                required
              />  {/* TODO: update name */}
              {t("forms:goal.derive_data_series_manually")}
            </label>
            <label className="flex width-fit-content align-items-center gap-50 margin-bottom-100">
              <input
                checked={dataSeriesType === DataSeriesType.Inherited}
                onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
                value={DataSeriesType.Inherited} /* TODO: Recipe type data series */
                type="radio"
                name="alternative"
                required
              />
              {t("forms:goal.derive_data_series_recipe")}
            </label>
          </div>

          {(
            dataSeriesType === DataSeriesType.Static
          ) &&
            <ManualGoalForm currentGoal={currentGoal} dataSeriesString={dataSeriesString} />
          }
          {(
            !dataSeriesType // Fallback for undefined or otherwise falsy
            || dataSeriesType === DataSeriesType.Inherited
            || dataSeriesType === DataSeriesType.Combined
          ) &&
            <RecipeContextProvider>
              {/* TODO: Want to clear recipe when switching between suggested or custom recipes? */}

              <SuggestedRecipeToggle />

              <FormIntegration
                RecipeFormElement={<input name="resultingRecipe" />}
                DateValuesFormElement={<input name="resultingDateValues" />}
              />
            </RecipeContextProvider>
          }
        </fieldset>

        {/* Baseline selection section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend
            data-position={positionIndex++}
            className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}
          >
            {t("forms:goal.choose_baseline_for_actions")}
          </legend>

          <label>
            {t("forms:goal.baseline_label")}
            <select className="block margin-top-25 margin-bottom-100" name="baselineSelector" id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
              <option value={BaselineType.Initial}>{t("forms:goal.baseline_types.initial")}</option>
              <option value={BaselineType.Custom}>{t("forms:goal.baseline_types.custom")}</option>
              <option value={BaselineType.Inherited}>{t("forms:goal.baseline_types.inherited")}</option>
            </select>
          </label>

          {/* Custom baseline input */}
          {baselineType === BaselineType.Custom &&
            <DateValuesInput
              dataSeriesString={baselineString}
              inputName="baselineDataSeries"
              inputId="baselineDataSeries"
              labelKey="forms:data_series_input.custom_baseline"
            />
          }

          {/* Inherited baseline input */}
          {baselineType === BaselineType.Inherited &&
            <InheritingBaseline />
          }
        </fieldset>

        {/* TODO suggested recipes to inherit with */}

        {/* External links section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.feature_this_goal")}</legend>
          <label className="flex align-items-center gap-50 margin-bottom-100">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} />
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset >

        {/* Submit button */}
        <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
          <button
            className="text-align-center seagreen color-purewhite width-100"
            style={{ fontSize: '14px', transform: 'none' }}
            type="submit"
            id="submit-button"
          >
            {currentGoal ? t("common:tsx.save") : t("forms:goal.create")}
          </button>
        </div>
      </form >
    </>
  )
}