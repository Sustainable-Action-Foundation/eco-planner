'use client';

import { closeModal, openModal } from "./modalFunctions";
import { useRef, useState } from "react";
import { GoalCreateInput, Goal, dataSeriesDataFieldNames } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import { DataSeriesArray, RawRecipe } from "@/functions/recipe-parser/types";
import { recipeFromUnknown } from "@/functions/parseRecipe";
import { RecipeContextProvider, RecipeSuggestions, RecipeVariableEditor, ResultingDataSeries, ResultingRecipe } from "../recipe/recipeEditor";

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
  // // TODO - remove. This is a debugging measure.
  // useEffect(() => {
  //   if (modalRef.current) {
  //     openModal(modalRef)
  //   }
  // }, []);

  async function formSubmission(form: FormData) {
    setIsLoading(true);

    // Id of the roadmap to copy the goal to
    const copyToId = form.get("copyTo");
    if (copyToId instanceof File) {
      setIsLoading(false);
      throw new Error("Why is this a file?");
    }

    const resultingDataSeriesString = form.get("resultingDataSeries");
    let parsedDataSeries: DataSeriesArray | undefined;
    try {
      parsedDataSeries = JSON.parse(resultingDataSeriesString as string) as DataSeriesArray;
    } catch (error) {
      setIsLoading(false);
      console.error("Failed to parse resulting data series:", error);
      return;
    }

    const resultingRecipeString = form.get("resultingRecipe");
    let evaluatedRecipe: RawRecipe | undefined;
    try {
      evaluatedRecipe = recipeFromUnknown(resultingRecipeString);
      if (!evaluatedRecipe) {
        throw new Error("Failed to parse resulting recipe");
      }
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse recipe:", error);
      return;
    }

    const unit: string | undefined = parsedDataSeries.unit;
    if (unit && typeof unit !== "string") {
      setIsLoading(false);
      console.error("Recipe unit is not a string:", unit);
      return;
    }

    const dataSeriesArray = dataSeriesDataFieldNames.map(field => {
      const value = parsedDataSeries[field as keyof typeof parsedDataSeries];
      if (typeof value === 'string') {
        return parseFloat(value);
      }
      return value ?? null;
    });

    const formData: GoalCreateInput & { roadmapId: string } = {
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      dataUnit: goal.dataSeries?.unit,
      dataSeriesArray: dataSeriesArray,
      roadmapId: copyToId as string ?? "",
      recipeHash: form.get("recipeSuggestion") as string,
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
                  {`${roadmap.name} ${roadmap.version ? `(${t("components:copy_and_scale.version")} ${roadmap.version.toString()})` : ""}`}
                </option>
              ))}
            </select>
          </label>

          <RecipeContextProvider>
            {/* Suggested recipes */}
            {goal.recipeSuggestions.length > 0 &&
              <RecipeSuggestions
                suggestedRecipes={goal.recipeSuggestions}
              />
            }

            <RecipeVariableEditor />

            <ResultingDataSeries
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