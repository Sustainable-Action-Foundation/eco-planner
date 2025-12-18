'use client';

import { closeModal, openModal } from "./modalFunctions";
import { useRef, useState } from "react";
import { GoalCreateInput, Goal, Years, DataSeriesValueFields, isPartialDataSeriesValueFields, JSONValue, isFullDataSeriesValueFields, nullFullDataSeriesValueField } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { isRecipeDataSeries, Recipe, RecipeDataTypes } from "@/functions/recipe/types";
import { recipeFromUnknown } from "@/functions/recipe/parseRecipe";
import { RecipeContextProvider } from "../recipe/contextProvider";
import { SuggestedRecipeApplier } from "@/components/recipe/suggestions/suggestedRecipeApplier";
import FormIntegration from "../recipe/editor/output/formIntegration";

export default function CopyAndScale({
  goal,
  roadmapOptions,
}: {
  goal: Goal,
  roadmapOptions: { id: string, name: string, version: number | null, actor: string | null }[],
}) {
  const { t } = useTranslation("components");
  const [isLoading, setIsLoading] = useState(false);

  const modalRef = useRef<HTMLDialogElement | null>(null);

  function formSubmission(form: FormData) {
    setIsLoading(true);

    // Id of the roadmap to copy the goal to
    const copyToId = form.get("copyTo");
    if (copyToId instanceof File) {
      setIsLoading(false);
      throw new Error("Why is this a file?");
    }

    // Try parsing the data series object from the recipe editor
    let resultingDataSeries: DataSeriesValueFields;
    try {
      const unparsedDataSeries = JSON.parse(form.get("resultingDataSeries") as string) as JSONValue;

      // At first expect the data series to be partial
      if (!isPartialDataSeriesValueFields(unparsedDataSeries)) {
        throw new Error("Parsed data series does not match expected structure");
      }

      // Make it non partial
      const parsedDataSeries = { ...nullFullDataSeriesValueField, ...unparsedDataSeries };
      if (!isFullDataSeriesValueFields(parsedDataSeries)) {
        throw new Error("Parsed data series is missing some years or has incorrect structure");
      }

      resultingDataSeries = parsedDataSeries;
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse resulting data series:", error);
      return;
    }

    let recipeUsed: Recipe | undefined;
    try {
      const unparsedRecipe = form.get("resultingRecipe");
      if (unparsedRecipe instanceof File) {
        setIsLoading(false);
        throw new Error("Why is this a file?");
      }
      recipeUsed = recipeFromUnknown(unparsedRecipe);
      if (!recipeUsed) {
        throw new Error("Failed to parse recipe from form data");
      }
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse recipe:", error);
      return;
    }

    // Make the data series into an api compatible string array
    const rawDataSeries: string[] = Years.map(year => {
      const value = resultingDataSeries[year];
      return value ? value.toString() : "";
    });

    const formData: GoalCreateInput = {
      goalId: undefined,
      timestamp: undefined,

      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      isFeatured: undefined,

      externalDataset: null,
      externalTableId: null,
      externalSelection: null,

      recipeUsed: recipeUsed,

      rawDataSeries: rawDataSeries,
      rawDataSeriesUnit: goal.dataSeries?.unit,
      rawBaselineDataSeries: undefined,
      rawBaselineDataSeriesUnit: undefined,

      roadmapId: copyToId as string ?? "",
      // TODO: copy tags?
      rawTags: undefined,
      links: undefined,
    };

    const formJSON = JSON.stringify(formData);

    formSubmitter('/api/goal', formJSON, 'POST', t, setIsLoading);
  }

  return (
    <>
      {/* Opening button */}
      <button
        type="button"
        className="seagreen color-purewhite smooth padding-block-50 padding-inline-100 smooth"
        onClick={() => openModal(modalRef)}
        style={{ padding: '.3rem .6rem', fontSize: '.75rem', lineHeight: '1.5' }}
      >
        {t("components:copy_and_scale.copy_and_scale")}
      </button>

      {/* Modal */}
      <dialog ref={modalRef} aria-modal className="rounded" style={{ border: '0', boxShadow: '0 0 .5rem -.25rem rgba(0,0,0,.25)', width: '90dvw' }}>
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
                  {`${roadmap.name} ${roadmap.version ? `(${t("components:copy_and_scale.version")} ${roadmap.version.toString()})` : ""}`}
                </option>
              ))}
            </select>
          </label>

          <RecipeContextProvider>
            <SuggestedRecipeApplier
              permissions={{
                allowAddVariables: false,
                allowDeleteVariables: false,
                allowNameEditing: false,
                allowTypeEditing: false,
                allowValueEditing: true,
              }}
              DEPRECATED_recipeOverrideFunctions={[
                // Set the value of the first data series to be of this goal
                (r => {
                  if (!goal.dataSeries) {
                    console.warn("Goal has no data series to set scaling reference");
                    return r;
                  }

                  const firstDataSeries = Object.entries(r.variables)
                    .find(([_n, v]) => v.type === RecipeDataTypes.DataSeries);

                  const firstDataSeriesName = firstDataSeries?.[0];
                  if (!firstDataSeriesName) {
                    console.warn("No data series variable found to set scaling reference");
                    return r;
                  }
                  const firstDataSeriesVariable = firstDataSeries?.[1];

                  if (!isRecipeDataSeries(firstDataSeriesVariable)) {
                    console.warn("First data series variable is not of type RecipeDataSeries");
                    return r;
                  }

                  firstDataSeriesVariable.link = goal.dataSeries.id;
                  firstDataSeriesVariable.unit = goal.dataSeries.unit;
                  // TODO: remove evil, see the type def for RecipeDataSeriesVariable
                  firstDataSeriesVariable.goalName = goal.name || goal.indicatorParameter;
                  firstDataSeriesVariable.disabled = true;

                  return {
                    ...r,
                    variables: {
                      ...r.variables,
                      [firstDataSeriesName]: firstDataSeriesVariable,
                    },
                  };
                })
              ]}
            />

            <FormIntegration
              DataSeriesFormElement={<input name="resultingDataSeries" />}
              RecipeFormElement={<input name="resultingRecipe" />}
            />
          </RecipeContextProvider>

          <button className="block seagreen color-purewhite smooth width-100 margin-inline-auto font-weight-500">
            {t("components:copy_and_scale.create_scaled_copy")}
          </button>
        </form>
      </dialog>
    </>
  )
}