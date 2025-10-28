'use client';

import { closeModal, openModal } from "./modalFunctions";
import { useRef, useState } from "react";
import { GoalCreateInput, Goal, Years, DataSeriesValueFields, isPartialDataSeriesValueFields, JSONValue, isFullDataSeriesValueFields } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { Recipe } from "@/functions/recipe-parser/types";
import { recipeFromUnknown } from "@/functions/parseRecipe";
import { RecipeContextProvider } from "../recipe/contextProvider";
import { ResultingRecipe } from "@/components/recipe/editor/output/output";
import OutputDataSeries from "../recipe/editor/output/dataSeries";
import VariableEditor from "../recipe/editor/variable/editor"; 
import { RecipeSuggestions } from "@/components/recipe/suggested"; 

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
      const parsedDataSeries = JSON.parse(form.get("resultingDataSeries") as string) as JSONValue;
      // At first expect the data series to be partial
      if (!isPartialDataSeriesValueFields(parsedDataSeries)) {
        throw new Error("Parsed data series does not match expected structure");
      }

      // Make it non-partial for easier transformation to string[] later
      for (const year of Years) {
        if (!(year in parsedDataSeries)) {
          parsedDataSeries[year] = null; // Ensure all years are present
        }
      }
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
            {/* Suggested recipes */}
            {goal.recipeSuggestions.length > 0 &&
              <RecipeSuggestions
                // TODO: change this cast into a proper type guard in RecipeSuggestions.tsx
                suggestedRecipes={goal.recipeSuggestions as { hash: string, recipe: Recipe }[]}
              />
            }

            <VariableEditor />

            <OutputDataSeries
              FormElement={<input type="hidden" name="resultingDataSeries" />}
            />
            <ResultingRecipe
              FormElement={<input type="hidden" name="resultingRecipe" />}
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