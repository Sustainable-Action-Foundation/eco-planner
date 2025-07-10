/*
GoalForm Component (React, TypeScript)
======================================

Summary:
--------
This file defines the main form for creating and editing "Goal" objects in the eco-planner app. It supports static, inherited, and combined goal types, as well as custom scaling, baseline data, and external links. The form is highly dynamic, adapting its fields and logic based on the current goal and user selections. It uses i18n for translations, and integrates with several subcomponents for modularity. The form's structure and submission logic are tightly coupled to the shape of the Goal object in the database, so any changes to the Goal schema require updates here.

Key Features:
- Handles three goal types: Static, Inherited, Combined
- Supports custom scaling recipes and methods
- Allows selection of baseline data (initial, custom, inherited)
- Integrates with roadmap selection and external links
- Uses modular subcomponents for complex form sections
- Submits data as JSON to the API, with careful handling of optional/complex fields
- Uses i18n for all user-facing text
- Designed for extensibility and maintainability
*/

'use client';

// Import dependencies and subcomponents
import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput"; // For handling external links
import { getScalingResult } from "@/components/modals/copyAndScale"; // For calculating scaling results
import RepeatableScaling from "@/components/repeatableScaling"; // For rendering repeatable scaling inputs
import type getRoadmaps from "@/fetchers/getRoadmaps.ts"; // Type for roadmap fetching
import formSubmitter from "@/functions/formSubmitter"; // Handles form submission to API
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" }; // Options for indicator parameter
import mathjs from "@/math"; // Math library for unit parsing
import { GoalCreateInput, ScaleBy, ScaleMethod, ScalingRecipe, dataSeriesDataFieldNames, isScalingRecipe } from "@/types"; // Types and helpers
import { DataSeries, Goal } from "@prisma/client"; // Prisma types
import { useEffect, useMemo, useState } from "react"; // React hooks
import { useTranslation } from "react-i18next"; // i18n hook
import DataSeriesInput from "../dataSeriesInput/dataSeriesInput"; // For entering data series
import { getDataSeries } from "../dataSeriesInput/utils"; // Helper for extracting data series from form
import styles from '../forms.module.css'; // CSS module for styling
import { CombinedGoalForm, InheritedGoalForm, InheritingBaseline, ManualGoalForm } from "./goalFormSections"; // Subcomponents for form sections
import { IconCircleMinus } from "@tabler/icons-react"; // Icon for removing scaling entries

// Enum for selecting the type of data series for the goal
enum DataSeriesType {
  Static = "STATIC",      // Manually entered data
  Inherited = "INHERIT", // Inherited from another goal
  Combined = "COMBINE",  // Combination of multiple goals
}

// Enum for selecting the type of baseline for the goal
enum BaselineType {
  Initial = "INITIAL",    // Use initial value as baseline
  Custom = "CUSTOM",      // User provides custom baseline
  Inherited = "INHERIT",  // Inherit baseline from another goal
}

// Main GoalForm component
export default function GoalForm({
  roadmapId,
  roadmapAlternatives,
  currentGoal,
}: {
  roadmapId?: string, // ID of the parent roadmap (if already selected)
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>, // List of possible roadmaps
  currentGoal?: Goal & { // Current goal (if editing)
    dataSeries: DataSeries | null,
    baselineDataSeries: DataSeries | null,
    combinationScale: string | null,
    combinationParents: {
      isInverted: boolean,
      parentGoal: {
        id: string,
        dataSeries: DataSeries | null,
        roadmapId: string,
      }
    }[],
    author: { id: string, username: string },
    links?: { url: string, description: string | null }[],
    roadmap: { id: string },
  },
}) {
  const { t } = useTranslation(["forms", "common"]); // i18n translation hook

  // State for the type of data series (static, inherited, combined)
  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(!currentGoal?.combinationParents.length ? DataSeriesType.Static : currentGoal.combinationParents.length >= 2 ? DataSeriesType.Combined : DataSeriesType.Inherited)
  // State for the type of baseline (initial, custom, inherited)
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baselineDataSeries ? BaselineType.Custom : BaselineType.Initial)
  // State for the scaling recipe (used for combined/inherited goals)
  const [scalingRecipe, setScalingRecipe] = useState<ScalingRecipe>({ values: [] });
  // State for the calculated scaling result (displayed in the form)
  const [scalingResult, setScalingResult] = useState<number | null>(null);
  // State for the selected roadmap (if not already fixed)
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(currentGoal?.roadmapId || roadmapId || "");

  // Effect: Parse and set the scaling recipe from the current goal (if editing)
  useEffect(() => {
    try {
      const parsed = JSON.parse(currentGoal?.combinationScale ?? "")
      if (isScalingRecipe(parsed)) {
        setScalingRecipe(parsed)
      } else if (typeof parsed == "number") {
        setScalingRecipe({ method: ScaleMethod.Geometric, values: [{ value: parsed, weight: 1 }] })
      }
    }
    // Fail silently if combination scale is missing, notify user if it's malformed
    catch (error) {
      if (currentGoal?.combinationScale) {
        console.error("Failed to parse scaling recipe", error)
      }
    }
  }, [currentGoal]);

  // Memoized timestamp for the form submission (used for optimistic updates)
  const timestamp = useMemo(() => Date.now(), []);

  // Form submission handler
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);

    // Extract links from the form
    const links = getLinks(event.target);

    // Extract data series (array of numbers as strings)
    const dataSeries = getDataSeries(form);

    // Extract baseline data series (if any)
    const baselineDataSeriesArray = getDataSeries(form, "baselineDataSeries");
    const baselineDataSeries = baselineDataSeriesArray.length > 0 ? baselineDataSeriesArray : undefined; // Omit if empty

    // Get scaling recipe for combined/inherited goals
    const { scalingRecipe: combinationScale } = getScalingResult(formData, scalingRecipe.method || ScaleMethod.Geometric);

    // Build inheritFrom array (for inherited/combined goals)
    const inheritFrom: GoalCreateInput["inheritFrom"] = [];
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
    const formJSON = JSON.stringify({
      name: (form.namedItem("goalName") as HTMLInputElement)?.value || null,
      description: (form.namedItem("description") as HTMLInputElement)?.value || null,
      indicatorParameter: (form.namedItem("indicatorParameter") as HTMLInputElement)?.value || null,
      // TODO: Add a toggle isUnitless to the form, which sets dataUnit to null if checked
      dataUnit: parsedUnit || (form.namedItem("dataUnit") as HTMLInputElement)?.value,
      dataSeries: dataSeries,
      baselineDataSeries: baselineDataSeries ?? null,
      combinationScale: JSON.stringify(combinationScale),
      inheritFrom: inheritFrom,
      roadmapId: currentGoal?.roadmapId || roadmapId || (typeof formData.get("roadmapId") == "string" ? formData.get("roadmapId") : null),
      goalId: currentGoal?.id || null,
      links,
      timestamp,
      isFeatured: (form.namedItem('isFeatured') as HTMLInputElement)?.checked,
    } as GoalCreateInput);

    // Submit the form to the API (POST for new, PUT for edit)
    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST');
  }

  // Recalculate scaling result when form changes (for combined/inherited goals)
  async function recalculateScalingResult() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the form to update
    if (typeof document != "undefined") {
      const formElement = document.forms.namedItem("goalForm");
      if (formElement instanceof HTMLFormElement) {
        const formData = new FormData(formElement);
        const scalingMethod = formData.get("scalingMethod")?.valueOf() as ScaleMethod;
        const { scaleFactor, scalingRecipe: tempRecipe } = getScalingResult(formData, scalingMethod || ScaleMethod.Geometric);
        // Avoid setting state if the value hasn't changed.
        if (tempRecipe !== scalingRecipe) {
          setScalingRecipe(tempRecipe);
        }
        if (Number.isFinite(scaleFactor) && scaleFactor !== scalingResult) {
          setScalingResult(scaleFactor);
        } else if (isNaN(scaleFactor) && scalingResult !== null) {
          setScalingResult(null);
        }
      }
    }
  }

  // Prepare data series string for default value (if editing)
  const dataArray: (number | null)[] = []
  if (currentGoal?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentGoal.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  // Prepare baseline data series string for default value (if editing)
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

  // Index for data-position attribute in legend elements (for accessibility)
  let positionIndex = 1;

  // Render the form
  return (
    <>
      <form onSubmit={handleSubmit} onChange={() => { recalculateScalingResult() }} name="goalForm">
        {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        {/* Allow user to select parent roadmap if not already selected */}
        {!(roadmapId || currentGoal?.roadmapId) ?
          <fieldset className={`${styles.timeLineFieldset} width-100`}>
            <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold`}>{t("forms:goal.choose_relationship")}</legend>
            <label className="block margin-block-100">
              {t("forms:goal.relationship_label")}
              <select name="roadmapId" id="roadmapId" required className="block margin-block-25" defaultValue={""}
                onChange={(e) => setSelectedRoadmap(e.target.value)}
              >
                <option value="" disabled>{t("forms:goal.relationship_no_chosen")}</option>
                {roadmapAlternatives.map(roadmap => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {`${roadmap.metaRoadmap.name} (v${roadmap.version}): ${t("forms:goal.action_count", { count: roadmap._count.goals })}`}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          : null
        }

        {/* Data series type selection (static, inherited, combined) */}
        <fieldset className={`${styles.timeLineFieldset} width-100 ${positionIndex > 1 ? "margin-top-200" : ""}`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend}  font-weight-bold`}>{t("forms:goal.data_series_type_legend")}</legend>
          <label className="block margin-block-100">
            {t("forms:goal.data_series_type_label")}
            <select name="dataSeriesType" id="dataSeriesType" className="block margin-block-25" required
              defaultValue={!currentGoal?.combinationParents.length ? DataSeriesType.Static : currentGoal.combinationParents.length >= 2 ? DataSeriesType.Combined : DataSeriesType.Inherited}
              onChange={(e) => setDataSeriesType(e.target.value as DataSeriesType)}
            >
              <option value={DataSeriesType.Static}>{t("forms:goal.data_series_types.static")}</option>
              <option value={DataSeriesType.Inherited}>{t("forms:goal.data_series_types.inherited")}</option>
              <option value={DataSeriesType.Combined}>{t("forms:goal.data_series_types.combined")}</option>
            </select>
          </label>
        </fieldset>

        {/* Goal name and description */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.goal_description_legend")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:goal.goal_name")}
            <input className="margin-block-25" type="text" name="goalName" id="goalName" defaultValue={currentGoal?.name ?? undefined} />
          </label>

          <label className="block margin-block-100">
            {t("forms:goal.goal_description")}
            <textarea className="margin-block-25" name="description" id="description" defaultValue={currentGoal?.description ?? undefined}></textarea>
          </label>
        </fieldset>

        {/* Data series input section (varies by type) */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.choose_goal_data_series")}</legend>
          {(dataSeriesType === DataSeriesType.Static || !dataSeriesType) &&
            <ManualGoalForm currentGoal={currentGoal} dataSeriesString={dataSeriesString} />
          }

          {dataSeriesType === DataSeriesType.Inherited &&
            <InheritedGoalForm currentGoal={currentGoal} roadmapAlternatives={roadmapAlternatives} />
          }

          {dataSeriesType === DataSeriesType.Combined &&
            <CombinedGoalForm currentGoal={currentGoal} roadmapId={currentGoal?.roadmapId || roadmapId || selectedRoadmap} />
          }

          {/* Scaling section for inherited/combined goals */}
          {(dataSeriesType === DataSeriesType.Inherited || dataSeriesType === DataSeriesType.Combined) &&
            <fieldset className="padding-50 smooth position-relative" style={{ border: '1px solid var(--gray-90)' }}>
              <legend>{t("forms:goal.scaling_legend")}</legend>
              <div className="margin-block-100">
                {scalingRecipe.values.map((value, index) => {
                  return (
                    <RepeatableScaling
                      key={`scalar-${index}`}
                      useWeight={scalingRecipe.method != ScaleMethod.Multiplicative}
                      defaultSpecificValue={value.type == ScaleBy.Custom || !value.type ? value.value : undefined}
                      defaultParentArea={value.type == ScaleBy.Area || value.type == ScaleBy.Inhabitants ? value.parentArea : undefined}
                      defaultChildArea={value.type == ScaleBy.Area || value.type == ScaleBy.Inhabitants ? value.childArea : undefined}
                      defaultScaleBy={value.type || ScaleBy.Custom}
                    > {/* Multiplicative scaling doesn't use weights */}
                      <button type="button" className="grid" aria-label={t("forms:goal.remove_scaling")}
                        onClick={() => setScalingRecipe({ method: scalingRecipe.method, values: scalingRecipe.values.filter((_, i) => i !== index) })}>
                        <IconCircleMinus aria-hidden="true" width={24} height={24} />
                      </button>
                    </RepeatableScaling>
                  )
                })}
              </div>
              <button type="button" className="margin-block-100" onClick={() => setScalingRecipe({ method: scalingRecipe.method, values: [...scalingRecipe.values, { value: 1 }] })}>{t("forms:goal.add_scaling")}</button>

              <label className="block margin-block-100">
                {t("forms:goal.scaling_method_legend")}
                <select name="scalingMethod" id="scalingMethod" className="margin-inline-25" defaultValue={scalingRecipe.method || ScaleMethod.Geometric}>
                  <option value={ScaleMethod.Geometric}>{t("common:scaling_methods.geo_mean")}</option>
                  <option value={ScaleMethod.Algebraic}>{t("common:scaling_methods.arith_mean")}</option>
                  <option value={ScaleMethod.Multiplicative}>{t("common:scaling_methods.multiplicative")}</option>
                </select>
              </label>

              <label className="block margin-block-100">
                <strong className="block bold">{t("forms:goal.resulting_factor")}</strong>
                <output className="margin-block-100 block">{scalingResult}</output>
              </label>
            </fieldset>
          }
        </fieldset>

        {/* Baseline selection section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:goal.choose_baseline_for_actions")}</legend>
          <label className="block margin-bottom-100">
            {t("forms:goal.baseline_label")}
            <select className="block margin-block-25" name="baselineSelector" id="baselineSelector" value={baselineType} onChange={(e) => setBaselineType(e.target.value as BaselineType)}>
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
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:goal.attach_external_resources")}</legend>
          <LinkInput links={currentGoal?.links} />
        </fieldset>

        {/* Feature this goal section */}
        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.feature_this_goal")}</legend>
          <label className="flex align-items-center gap-50 margin-block-50">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} /> {/* TODO: Make toggle */}
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset>

        {/* Submit button */}
        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentGoal ? t("common:tsx.save") : t("common:tsx.create")} />
      </form>

      {/* Datalist for indicator parameter suggestions */}
      <datalist id="LEAPOptions">
        {/* Use all unique entries as suggestions for indicator parameter */}
        {parameterOptions.filter((option, index, self) => {
          return self.indexOf(option) === index
        }).map((option) => {
          return (
            <option key={`option-${option}`} value={option} />
          )
        })}
      </datalist>
    </>
  )
}