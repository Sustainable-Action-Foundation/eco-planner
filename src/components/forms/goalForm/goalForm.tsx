'use client';

import LinkInput, { getLinks } from "@/components/forms/linkInput/linkInput";
import { getScalingResult } from "@/components/modals/copyAndScale";
import RepeatableScaling from "@/components/repeatableScaling";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import formSubmitter from "@/functions/formSubmitter";
import parameterOptions from "@/lib/LEAPList.json" with { type: "json" };
import mathjs from "@/math";
import { GoalCreateInput, ScaleBy, ScaleMethod, ScalingRecipe, dataSeriesDataFieldNames, isScalingRecipe } from "@/types";
import { DataSeries, Goal } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import DataSeriesInput from "../dataSeriesInput/dataSeriesInput";
import { getDataSeries } from "../dataSeriesInput/utils";
import styles from '../forms.module.css';
import { CombinedGoalForm, InheritedGoalForm, InheritingBaseline, ManualGoalForm } from "./goalFormSections";
import { IconCircleMinus } from "@tabler/icons-react";

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
  const { t } = useTranslation(["forms", "common"]);

  const [dataSeriesType, setDataSeriesType] = useState<DataSeriesType>(!currentGoal?.combinationParents.length ? DataSeriesType.Static : currentGoal.combinationParents.length >= 2 ? DataSeriesType.Combined : DataSeriesType.Inherited)
  const [baselineType, setBaselineType] = useState<BaselineType>(currentGoal?.baselineDataSeries ? BaselineType.Custom : BaselineType.Initial)
  const [scalingRecipe, setScalingRecipe] = useState<ScalingRecipe>({ values: [] });
  const [scalingResult, setScalingResult] = useState<number | null>(null);
  const [selectedRoadmap, setSelectedRoadmap] = useState<string>(currentGoal?.roadmapId || roadmapId || "");

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

  const timestamp = useMemo(() => Date.now(), []);

  // Submit the form to the API
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.target.elements;
    const formData = new FormData(event.target);

    const links = getLinks(event.target);

    // Get data series as an array of numbers in string format, the actual parsing is done by the API
    const dataSeries = getDataSeries(form);

    // And likewise for the baseline data series, if any
    const baselineDataSeriesArray = getDataSeries(form, "baselineDataSeries");
    const baselineDataSeries = baselineDataSeriesArray.length > 0 ? baselineDataSeriesArray : undefined; // The baseline may be omitted, in which case we don't want to send an empty array

    const { scalingRecipe: combinationScale } = getScalingResult(formData, scalingRecipe.method || ScaleMethod.Geometric);

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

    let parsedUnit: string | null = null;
    try {
      parsedUnit = mathjs.unit((form.namedItem("dataUnit") as HTMLInputElement)?.value).toString();
    } catch {
      console.log("Failed to parse unit. Using raw string instead, which may disable some features.");
    }

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

    formSubmitter('/api/goal', formJSON, currentGoal ? 'PUT' : 'POST');
  }

  async function recalculateScalingResult() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the form to update; without this we get the value *before* the action that triggered the update
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

  // If there is a data series, convert it to an array of numbers to use as a default value for the form
  const dataArray: (number | null)[] = []
  if (currentGoal?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentGoal.dataSeries[i])
    }
  }
  const dataSeriesString = dataArray.join(';')

  // Likewise for any baseline data series
  const baselineArray: (number | null)[] = []
  if (currentGoal?.baselineDataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      baselineArray.push(currentGoal.baselineDataSeries[i])
    }
  }
  const baselineString = baselineArray.join(';')

  // Indexes for the data-position attribute in the legend elements
  let positionIndex = 1;

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
                        <IconCircleMinus aria-hidden="true" width={24} height={24}  />
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

          {baselineType === BaselineType.Custom &&
            <DataSeriesInput
              dataSeriesString={baselineString}
              inputName="baselineDataSeries"
              inputId="baselineDataSeries"
              labelKey="forms:data_series_input.custom_baseline"
            />
          }

          {baselineType === BaselineType.Inherited &&
            <InheritingBaseline />
          }
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} font-weight-bold padding-block-100`}>{t("forms:goal.attach_external_resources")}</legend>
          <LinkInput links={currentGoal?.links} />
        </fieldset>

        <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
          <legend data-position={positionIndex++} className={`${styles.timeLineLegend} padding-block-100 font-weight-bold`}>{t("forms:goal.feature_this_goal")}</legend>
          <label className="flex align-items-center gap-50 margin-block-50">
            <input type="checkbox" name="isFeatured" id="isFeatured" defaultChecked={currentGoal?.isFeatured} /> {/* TODO: Make toggle */}
            {t("forms:goal.feature_goal")}
          </label>
        </fieldset>

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentGoal ? t("common:tsx.save") : t("common:tsx.create")} />
      </form>

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