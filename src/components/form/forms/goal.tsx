'use client';

import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import formSubmitter from "@/functions/formSubmitter";
import mathjs from "@/math";
import { GoalCreateInput, GoalUpdateInput, Years } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DataSeriesInput from "../elements/dataSeriesInput/dataSeriesInput";
import { getDataSeries } from "../elements/dataSeriesInput/utils";
import styles from '../forms.module.css';
import { InheritingBaseline, ManualGoalForm } from "../sections/goalFormSections";
import { RecipeContextProvider } from "@/components/recipe/contextProvider";
import { Recipe } from "@/functions/recipe/types";
import { recipeFromUnknown } from "@/functions/recipe/parseRecipe";
import TextEditor from "../elements/textEditor/editor";
import { Content } from "@tiptap/core";
import SuggestedRecipeToggle from "@/components/recipe/suggestions/suggestedRecipeToggle";
import SelectSingleSearch from "../elements/combobox/selectSingleSearch";
import FormIntegration from "@/components/recipe/editor/output/formIntegration";

enum DataSeriesType {
  Static = "STATIC",
  Inherited = "INHERIT",
  Combined = "COMBINE",
}

enum BaselineType {
  Initial = "INITIAL",
  Custom = "CUSTOM",
  Inherited = "INHERIT",
}

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

    // Get data series as an array of numbers in string format, the actual parsing is done by the API
    const dataSeries = getDataSeries(form);

    // Extract baseline data series (if any)
    const baselineDataSeriesArray = getDataSeries(form, "baselineDataSeries");
    const baselineDataSeries = baselineDataSeriesArray.length > 0 ? baselineDataSeriesArray : undefined; // Omit if empty

    // Get scaling recipe for combined/inherited goals
    const recipeString = formData.get("resultingRecipe") as string | null;
    let parsedRecipe: Recipe | null = null;
    if (recipeString) {
      try {
        parsedRecipe = recipeFromUnknown(recipeString);
      }
      catch (error) {
        console.error("Failed to parse recipe from form data:", error);
        event.target.reportValidity();
        return;
      }
    }

    // TODO: deprecated - use recipes instead
    // Build inheritFrom array (for inherited/combined goals)
    const inheritFrom: { id: string, isInverted?: boolean }[] = [];
    formData.getAll("inheritFrom")?.forEach((id) => {
      if (id instanceof File) {
        return;
      } else if (formData.getAll("invert-inherit")?.includes(id)) {
        inheritFrom.push({ id: id, isInverted: true });
        return;
      } else {
        inheritFrom.push({ id: id });
      }
    })

    // Parse the unit (if provided)
    let parsedUnit: string | null = null;
    try {
      parsedUnit = mathjs.unit((form.namedItem("dataUnit") as HTMLInputElement)?.value).toString();
    } catch {
      console.log("Failed to parse unit. Using raw string instead, which may disable some features.");
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

        externalDataset: undefined,
        externalTableId: undefined,
        externalSelection: undefined,

        // TODO: Add a way to clear recipe
        recipeUsed: parsedRecipe || undefined,

        rawDataSeries: dataSeries || undefined,
        // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
        rawDataSeriesUnit: parsedUnit || formData.get("dataUnit") as string | null || undefined,
        // TODO: Add a way to clear baseline
        rawBaselineDataSeries: baselineDataSeries,
        rawBaselineDataSeriesUnit: baselineDataSeries ? parsedUnit || formData.get("dataUnit") as string | null || undefined : undefined,

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

        // Goals are currently created without historical data (external data), but the API can handle it if we change this later
        externalDataset: null,
        externalTableId: null,
        externalSelection: null,

        recipeUsed: parsedRecipe,

        rawDataSeries: dataSeries,
        // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
        rawDataSeriesUnit: parsedUnit || formData.get("dataUnit") as string | null || undefined,
        rawBaselineDataSeries: baselineDataSeries,
        rawBaselineDataSeriesUnit: baselineDataSeries ? parsedUnit || formData.get("dataUnit") as string | null || undefined : undefined,

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

  // Prepare data series string
  const dataArray: (number | null)[] = [];
  if (currentGoal?.dataSeries) {
    for (const i of Years) {
      dataArray.push(currentGoal.dataSeries[i]);
    }
  }
  const dataSeriesString = dataArray.join(';');

  // Prepare baseline data series string
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of Years) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

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
                UnitFormElement={<input name="dataUnit" />}
              />
            </RecipeContextProvider>
          }
        </fieldset>

        {/* Baseline selection section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>{t("forms:goal.choose_baseline_for_actions")}</legend>
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
            <DataSeriesInput
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