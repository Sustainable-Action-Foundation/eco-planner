'use client';

import { closeModal, openModal } from "./modalFunctions";
import { useEffect, useRef, useState } from "react";
import { GoalCreateInput, dataSeriesDataFieldNames, ScaleBy, ScaleMethod, ScalingRecipe, Goal } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { DataSeriesArray, RawRecipe, Recipe, RecipeVariableType } from "@/functions/recipe-parser/types";
import { evaluateRecipe, parseRecipe, recipeFromUnknown } from "@/functions/parseRecipe";

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
  const [recipeEq, setRecipeEq] = useState("");
  const [recipeVars, setRecipeVars] = useState<RawRecipe["variables"]>({});
  const [resultingDataSeries, setResultingDataSeries] = useState<DataSeriesArray & { unit?: string }>({});
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluationWarnings, setEvaluationWarnings] = useState<string[]>([]);

  const modalRef = useRef<HTMLDialogElement | null>(null);
  // // TODO - remove. This is a debugging measure.
  // useEffect(() => openModal(modalRef), []);

  function handleRecipeSuggestionChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedRecipeHash = e.target.value;
    if (selectedRecipeHash && selectedRecipeHash !== "none") {
      const selectedRecipe = goal.recipeSuggestions.find(r => r.hash === selectedRecipeHash)
      if (selectedRecipe) {
        const rawRecipe = recipeFromUnknown(selectedRecipe.recipe);
        setRecipeEq(rawRecipe.eq);
        setRecipeVars(rawRecipe.variables);
      }
    }
  }

  useEffect(() => {
    const customRecipe: RawRecipe = {
      eq: recipeEq,
      variables: recipeVars,
    };

    async function calculate() {
      setEvaluationError(null);
      setEvaluationWarnings([]);
      try {
        const parsedRecipe = await parseRecipe(customRecipe);
        const warnings: string[] = [];
        const evaluatedRecipe = await evaluateRecipe(parsedRecipe, warnings)
        setResultingDataSeries(evaluatedRecipe);
        setEvaluationWarnings(warnings);
      } catch (e: any) {
        console.info("CopyAndScale: Failed to evaluate recipe. Likely just evaluating while writing", e);
        setResultingDataSeries({});
        setEvaluationError(e.message);
      }
    }
    calculate();
  }, [recipeEq, recipeVars]);


  async function formSubmission(form: FormData) {
    setIsLoading(true);
    setEvaluationError(null);
    setEvaluationWarnings([]);

    // --- Evaluate recipe before submitting ---
    const customRecipe: RawRecipe = {
      eq: recipeEq,
      variables: recipeVars,
    };

    let finalDataSeries: DataSeriesArray & { unit?: string };
    try {
      const parsedRecipe = await parseRecipe(customRecipe);
      const warnings: string[] = [];
      finalDataSeries = await evaluateRecipe(parsedRecipe, warnings);
      setEvaluationWarnings(warnings);
    } catch (e: any) {
      console.error("CopyAndScale: Failed to evaluate recipe on submission", e);
      setEvaluationError(e.message);
      setIsLoading(false);
      return;
    }
    // --- End evaluation ---

    // Id of the roadmap to copy the goal to
    const copyToId = form.get("copyTo");
    if (copyToId instanceof File) {
      setIsLoading(false);
      throw new Error("Why is this a file?");
    }

    const noUnitDataSeries = { ...finalDataSeries };
    delete noUnitDataSeries.unit;

    const formData: GoalCreateInput & { roadmapId: string } = {
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      dataUnit: goal.dataSeries?.unit,
      dataSeriesArray: noUnitDataSeries,
      roadmapId: copyToId ?? "",
      recipeHash: form.get("recipeSuggestion") as string,
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/goal', formJSON, 'POST', setIsLoading);
  }

  const customRecipeEditor = (
    <>
      {/* Recipe errors */}
      {recipeEq && evaluationError && (
        <div className="margin-block-100" style={{ color: 'red' }}>
          <strong>{t("components:copy_and_scale.evaluation_error_title")}:</strong>
          <p>{evaluationError}</p>
        </div>
      )}

      {/* Recipe warnings */}
      {recipeEq && evaluationWarnings.length > 0 && (
        <div className="margin-block-100" style={{ color: 'orange' }}>
          <strong>{t("components:copy_and_scale.evaluation_warning_title")}:</strong>
          <ul>
            {evaluationWarnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        </div>
      )}
      
      {/* Custom recipe string */}
      <label className="block margin-block-50">
        <span className="block">{t("components:copy_and_scale.custom_recipe")}</span>
        <textarea
          name="recipeString"
          rows={5}
          placeholder={t("components:copy_and_scale.custom_recipe_placeholder")}
          className="block width-100"
          value={recipeEq}
          onChange={(e) => setRecipeEq(e.target.value)}
        />
      </label>
      {/* Recipe variables */}
      <div className="margin-inline-auto width-100">
        {t("components:copy_and_scale.recipe_variables")}
        <ul className="list-style-none padding-0">
          {Object.entries(recipeVars).map(([name, variable]) => (
            <li key={name} className="display-flex align-items-center gap-50 margin-block-25">
              <input
                type="text"
                value={name}
                className="flex-grow-1"
                readOnly
                disabled
              />
              <input
                type="text"
                value={
                  variable.type === RecipeVariableType.Scalar ? variable.value :
                    variable.type === RecipeVariableType.DataSeries && 'link' in variable ? `link: ${variable.link}` :
                      'Data Series'
                }
                className="flex-grow-1"
                onChange={(e) => {
                  if (variable.type === RecipeVariableType.Scalar) {
                    const newValue = parseFloat(e.target.value);
                    setRecipeVars(prev => ({
                      ...prev,
                      [name]: { ...variable, value: Number.isNaN(newValue) ? 0 : newValue }
                    }));
                  }
                }}
                readOnly={variable.type !== RecipeVariableType.Scalar}
              />
              <button type="button" className="red" onClick={() => {
                const newVars = { ...recipeVars };
                delete newVars[name];
                setRecipeVars(newVars);
              }}>X</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => {
          const newVarName = `var${Object.keys(recipeVars).length + 1}`;
          setRecipeVars(prev => ({
            ...prev,
            [newVarName]: { type: RecipeVariableType.Scalar, value: 1 }
          }));
        }}>{t("components:copy_and_scale.add_variable")}</button>
      </div>
    </>
  )

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
      <dialog ref={modalRef} aria-modal className="rounded" style={{ border: '0', boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25', width: '90dvw' }}>
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
        <form action={formSubmission} name="copyAndScale">

          {/* Roadmap version select */}
          <label className="block margin-block-100">
            {t("components:copy_and_scale.select_roadmap_version")}
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
            {goal.recipeSuggestions.map((recipe, index) => (
              <label key={index} className="block margin-block-50">
                <input type="radio" name="recipeSuggestion" value={recipe.hash} onChange={handleRecipeSuggestionChange} />
                {" "}
                <>
                  {(recipe.recipe as Recipe).name ?? t("components:copy_and_scale.unnamed_suggestion")}
                  {" "}
                  <span style={{ color: "gray" }}>
                    Recept: ({(recipe.recipe as Recipe).eq})
                  </span>
                </>
              </label>
            ))}
          </>) : null}

          {goal.recipeSuggestions.length > 0 ? (
            <details className="margin-block-100">
              <summary>{t("components:copy_and_scale.advanced")}</summary>
              <div className="margin-block-100">
                {customRecipeEditor}
              </div>
            </details>
          ) : customRecipeEditor}

          {/* Resulting data series */}
          <label className="margin-inline-auto width-100">
            <strong className="block bold text-align-center">
              {t("components:copy_and_scale.resulting_data_series")}
              {/* Unit */}
              {resultingDataSeries.unit ? ` (${resultingDataSeries.unit})` : ""}
            </strong>
            <table className="margin-block-100 block width-100 overflow-x-scroll">
              <thead>
                <tr>
                  <th className="padding-50 text-align-center">{t("components:copy_and_scale.data_series_year")}</th>
                  {Object.keys(resultingDataSeries).map((year, i) => (
                    <th className="padding-50 text-align-center" key={i + "resulting-data-series-header" + year}>{year.replace("val", "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="padding-50 text-align-center">{t("components:copy_and_scale.data_series_value")}</td>
                  {Object.values(resultingDataSeries).map((value, i) => (
                    <td className="padding-50 text-align-center" key={i + "resulting-data-series-value" + value}>{(value as number)?.toFixed(1) || "-"}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </label>

          <button className="block seagreen color-purewhite smooth width-100 margin-inline-auto font-weight-500">
            {t("components:copy_and_scale.create_scaled_copy")}
          </button>
        </form>
      </dialog>
    </>
  )
}