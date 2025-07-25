'use client';

import { DataSeries } from "@prisma/client";
import { closeModal, openModal } from "./modalFunctions";
import { useEffect, useRef, useState } from "react";
import RepeatableScaling from "../repeatableScaling";
import { GoalCreateInput, dataSeriesDataFieldNames, ScaleBy, ScaleMethod, ScalingRecipe, Goal } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconCircleMinus, IconX } from "@tabler/icons-react";
import { Recipe } from "@/functions/recipe-parser/types";

/** Get the resulting scaling factor from form data */
export function getScalingResult(form: FormData, scalingMethod: ScaleMethod, setIsLoading?: React.Dispatch<React.SetStateAction<boolean>>) {
  const scalars = form.getAll("scaleFactor");
  const scalingTypes = form.getAll("scaleBy");
  const weights = form.getAll("weight");
  const parentAreas = form.getAll("parentArea");
  const childAreas = form.getAll("childArea")
  let scaleFactor: number = 1;
  let totalWeight: number;
  // Index for getting parentArea and childArea for ScaleBy.Inhabitants and ScaleBy.Area
  let mutableScalarIndex: number = 0;
  const scalingRecipe: ScalingRecipe = { values: [] }
  // If the input is a single value, use it as the scale factor
  if (scalars.length == 1) {
    // If any of the inputs are files, throw. This will only happen if the user has tampered with the form, so no need to give a nice error message
    if (scalars[0] instanceof File) {
      if (setIsLoading) setIsLoading(false);
      throw new Error("Why is this a file?");
    }
    const tempScale = parseFloat(scalars[0].replace(",", "."));
    const scalingType = scalingTypes[0] as (ScaleBy | "");
    const weight = parseFloat((weights[0] as string ?? "1").replace(",", "."));
    // If the value is a number, use it as the scale factor
    if (Number.isFinite(tempScale)) {
      scaleFactor = tempScale;
      if (scalingType == ScaleBy.Custom) {
        scalingRecipe.values.push({
          type: scalingType,
          value: tempScale,
          weight: Number.isFinite(weight) ? weight : 1,
        });
      } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
        scalingRecipe.values.push({
          type: scalingType,
          parentArea: parentAreas[mutableScalarIndex] as string,
          childArea: childAreas[mutableScalarIndex] as string,
          weight: Number.isFinite(weight) ? weight : 1,
        })
      } else {
        scalingRecipe.values.push({
          value: tempScale,
        });
      }
    };
  }
  // If there are multiple inputs, loop through them and calculate the average of the scale factors, based on the scaling method
  else if (scalars.length > 1) {
    switch (scalingMethod) {
      case ScaleMethod.Algebraic:
        scalingRecipe.method = ScaleMethod.Algebraic;
        totalWeight = 0;
        scaleFactor = 0;
        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File || weights[i] instanceof File || parentAreas[i] instanceof File || childAreas[i] instanceof File || scalingTypes[i] instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");
          const weight: number = parseFloat((weights[i] as string ?? "1").replace(",", "."));

          // If scalar is a number, add it to the total scale factor, weighted by the weight
          // If weight is not a number, default to 1 (but allow 0 to be used as a weight)
          if (Number.isFinite(scalar)) {
            if (Number.isFinite(weight)) {
              totalWeight += weight;
              scaleFactor += scalar * weight;
            } else {
              totalWeight += 1;
              scaleFactor += scalar * 1;
            }
            if (scalingType == ScaleBy.Custom) {
              scalingRecipe.values.push({
                type: scalingType,
                value: scalar,
                weight: Number.isFinite(weight) ? weight : 1,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipe.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
                weight: Number.isFinite(weight) ? weight : 1,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        // If the total weight is not 0, divide the scale factor by it to get the weighted average
        if (totalWeight != 0) {
          scaleFactor /= totalWeight;
        }
        break;
      case ScaleMethod.Multiplicative:
        scalingRecipe.method = ScaleMethod.Multiplicative;
        scaleFactor = 1;
        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");

          // If scalar is a number, multiply total scale factor with it
          if (Number.isFinite(scalar)) {
            scaleFactor *= scalar;
            if (scalingType == ScaleBy.Custom) {
              scalingRecipe.values.push({
                type: scalingType,
                value: scalar,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipe.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        break;
      // Default to geometric scaling
      case ScaleMethod.Geometric:
      default:
        scalingRecipe.method = ScaleMethod.Geometric;
        totalWeight = 0;
        scaleFactor = 1; // This initial value won't affect the result since it's the identity element for multiplication and is not given a weight

        for (let i = 0; i < scalars.length; i++) {
          if (scalars[i] instanceof File || weights[i] instanceof File || parentAreas[i] instanceof File || childAreas[i] instanceof File || scalingTypes[i] instanceof File) {
            if (setIsLoading) setIsLoading(false);
            throw new Error("Why is this a file?");
          }

          const scalar: number = parseFloat((scalars[i] as string).replace(",", "."));
          const scalingType = scalingTypes[i] as (ScaleBy | "");
          const weight: number = parseFloat((weights[i] as string ?? "1").replace(",", "."));

          // If scalar is a number, multiply total scale factor with it, weighted by the weight
          // If weight is not a number, default to 1 (but allow 0 to be used as a weight)
          if (Number.isFinite(scalar)) {
            if (Number.isFinite(weight)) {
              totalWeight += weight;
              scaleFactor *= Math.pow(scalar, weight);
            } else {
              totalWeight += 1;
              scaleFactor *= Math.pow(scalar, 1);
            }
            if (scalingType == ScaleBy.Custom) {
              scalingRecipe.values.push({
                type: scalingType,
                value: scalar,
                weight: Number.isFinite(weight) ? weight : 1,
              });
            } else if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
              scalingRecipe.values.push({
                type: scalingType,
                parentArea: parentAreas[mutableScalarIndex] as string,
                childArea: childAreas[mutableScalarIndex] as string,
                weight: Number.isFinite(weight) ? weight : 1,
              })
            }
          }
          if (scalingType == ScaleBy.Area || scalingType == ScaleBy.Inhabitants) {
            mutableScalarIndex += 1;
          }
        }
        // Take the totalWeight-th root of the scale factor to get the weighted geometric mean
        // Will return NaN if the scale factor is negative before taking the root
        scaleFactor = Math.pow(scaleFactor, (1 / totalWeight));
        break;
    }
  }
  return { scaleFactor, scalingRecipe: scalingRecipe };
}

export default function CopyAndScale({
  goal,
  roadmapOptions,
}: {
  goal: Goal,
  roadmapOptions: { id: string, name: string, version: number, actor: string | null }[],
}) {
  const { t } = useTranslation("components");
  const [isLoading, setIsLoading] = useState(false);
  const [scalingMethod, setScalingMethod] = useState<ScaleMethod>(ScaleMethod.Geometric);
  const [scalingResult, setScalingResult] = useState<number>(1);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  // TODO - remove. This is a debugging measure.
  useEffect(() => openModal(modalRef), []);

  async function recalculateScalingResult() {
    await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the form to update; without this we get the value *before* the action that triggered the update
    if (typeof document != "undefined") {
      const formElement = document.forms.namedItem("copyAndScale");
      if (formElement instanceof HTMLFormElement) {
        const formData = new FormData(formElement);
        const { scaleFactor } = getScalingResult(formData, scalingMethod);
        // Avoid setting the state if the value hasn't changed, to prevent infinite rerenders
        // Also don't set the state if the value is NaN, infinite, or non-numeric
        if (Number.isFinite(scaleFactor) && scaleFactor !== scalingResult) {
          setScalingResult(scaleFactor);
        }
      }
    }
  }
  recalculateScalingResult();

  function formSubmission(form: FormData) {
    setIsLoading(true);

    // If any of the inputs are files, throw. This will only happen if the user has tampered with the form, so no need to give a nice error message

    // Id of the roadmap to copy the goal to
    const copyToId = form.get("copyTo");
    if (copyToId instanceof File) {
      setIsLoading(false);
      throw new Error("Why is this a file?");
    }

    const { scaleFactor, scalingRecipe } = getScalingResult(form, scalingMethod, setIsLoading);
    // Don't proceed if the resultant scale factor is NaN, infinite, or non-numeric for some reason
    if (!Number.isFinite(scaleFactor)) {
      setIsLoading(false);
      alert(t("components:copy_and_scale.invalid_input"));
      return;
    }

    // Get the data series from current goal
    const dataSeries: string[] = [];
    for (const i of dataSeriesDataFieldNames) {
      const value = goal.dataSeries?.[i];
      if (value == undefined) {
        dataSeries.push("");
      } else {
        dataSeries.push((value * scaleFactor).toString());
      }
    }

    const formData: GoalCreateInput & { roadmapId: string } = {
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      dataUnit: goal.dataSeries?.unit,
      rawDataSeries: dataSeries,
      roadmapId: copyToId ?? "",
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/goal', formJSON, 'POST', setIsLoading);
  }

  return (
    <>
      {/* Opening button */}
      <button
        type="button"
        className="seagreen color-purewhite smooth padding-block-50 padding-inline-100 smooth"
        onClick={() => openModal(modalRef)}
        style={{ padding: '.3rem .6rem', fontSize: '.75rem' }}
      >
        {t("components:copy_and_scale.copy_and_scale")}
      </button>

      {/* Modal */}
      <dialog ref={modalRef} aria-modal className="rounded" style={{ border: '0', boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25' }}>
        {/* Title bar */}
        <div className={`display-flex flex-direction-row-reverse align-items-center justify-content-space-between`}>
          {/* Close button */}
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus aria-label={t("common:tsx.close")} >
            <IconX aria-hidden="true" width={18} height={18} strokeWidth={3} />
          </button>

          {/* Title */}
          <h2 className="margin-0">{t("components:copy_and_scale.title", { goalName: goal.name })}</h2>
        </div>

        {/* Scaling form */}
        <form action={formSubmission} name="copyAndScale" onChange={recalculateScalingResult}>

          {/* Roadmap version select */}
          <label className="block margin-block-100">
            {t("components:copy_and_scale.select_roadmap_version")}
            {/* TODO - auto select the latest one? */}
            <select className="block margin-block-25 width-100" required name="copyTo" id="copyTo">
              <option value="">{t("components:copy_and_scale.select_roadmap_version_option")}</option>
              {roadmapOptions.map(roadmap => (
                <option key={roadmap.id} value={roadmap.id}>
                  {`${roadmap.name} ${roadmap.version ? `(${t("components:copy_and_scale.version")} ${roadmap.version.toString()})` : null}`}
                </option>
              ))}
            </select>
          </label>

          {/* Suggested recipes */}
          {goal.recipeSuggestions.length > 0 ? (<>
            <label>
              <input type="radio" name="recipe-suggestion" />
              &nbsp;
              Ingen vald
            </label>
            {goal.recipeSuggestions.map((recipe, index) => (
              <label key={index} className="block margin-block-50">
                <input type="radio" name="recipe-suggestion" value={JSON.stringify(recipe)} />
                &nbsp;
                <>
                  {(recipe.recipe as Recipe).name ?? "Namnlöst förslag"} <span style={{ color: "gray" }}> Recept: ({(recipe.recipe as Recipe).eq})</span>
                </>
              </label>
            ))}
          </>) : (<></>)}

          {/* Repeatable scaling is deprecated TODO - remove */}
          {/* <div className="margin-block-100">
            {scalingComponents.map((id) => {
              return (
                <RepeatableScaling key={id} useWeight={scalingMethod != ScaleMethod.Multiplicative}>
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      top: '0',
                      right: '0',
                      transform: 'translate(50%, calc(-20px - 50%))',
                      backgroundColor: 'white',
                      padding: '.25rem',
                      borderRadius: '100%',
                      display: 'grid',
                      cursor: 'pointer'
                    }}
                    aria-label={t("components:copy_and_scale.remove_scaling")}
                    onClick={() => setScalingComponents(scalingComponents.filter((i) => i !== id))}
                  >
                    <IconCircleMinus aria-hidden="true" />
                  </button>
                </RepeatableScaling>
              )
            })}
          </div>
          <button type="button" className="margin-block-100" onClick={() => setScalingComponents([...scalingComponents, (crypto?.randomUUID() || Math.random().toString())])}>{t("components:copy_and_scale.add_scaling")}</button> */}
          {/* 
          <details className="padding-block-25 margin-block-75" style={{ borderBottom: '1px solid var(--gray-90)' }}>
            <summary>{t("components:copy_and_scale.advanced")}</summary>
            <fieldset className="margin-block-100">
              <legend>{t("components:copy_and_scale.scaling_method")}</legend>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Geometric} checked={scalingMethod === ScaleMethod.Geometric} onChange={() => setScalingMethod(ScaleMethod.Geometric)} />
                {t("common:scaling_methods.geo_mean")}
              </label>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Algebraic} checked={scalingMethod === ScaleMethod.Algebraic} onChange={() => setScalingMethod(ScaleMethod.Algebraic)} />
                {t("common:scaling_methods.arith_mean")}
              </label>
              <label className="flex gap-25 align-items-center margin-block-50">
                <input type="radio" name="scalingMethod" value={ScaleMethod.Multiplicative} checked={scalingMethod === ScaleMethod.Multiplicative} onChange={() => setScalingMethod(ScaleMethod.Multiplicative)} />
                {t("common:scaling_methods.multiplicative")}
              </label>
            </fieldset>
          </details> */}

          {/* <label className="margin-inline-auto">
            <strong className="block bold text-align-center">{t("components:copy_and_scale.resulting_scale_factor")}</strong>
            <output className="margin-block-100 block text-align-center">{scalingResult}</output>
          </label> */}

          <button className="block seagreen color-purewhite smooth width-100 margin-inline-auto font-weight-500">
            {t("components:copy_and_scale.create_scaled_copy")}
          </button>
        </form>
      </dialog>
    </>
  )
}