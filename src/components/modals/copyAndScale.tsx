'use client';

import { closeModal, openModal } from "./modalFunctions";
import { useRef, useState } from "react";
import { isDateValues } from "@/types";
import type { GoalCreateInput, Goal, DateValues, JSONValue } from "@/types";
import formSubmitter from "@/functions/formSubmitter";
import { useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";
import styles from "../form/api/queryBuilder.module.css";
import { Recipe } from "@/functions/recipe";
import { FormIntegration, RecipeContextProvider, SuggestedRecipeApplier } from "@/components/recipe";


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
    let resultingDataSeries: DateValues;
    try {
      const parsedDataSeries = JSON.parse(form.get("resultingDataSeries") as string) as JSONValue;

      // At first expect the data series to be partial
      if (!isDateValues(parsedDataSeries)) {
        throw new Error("Parsed data series does not match expected structure");
      }

      resultingDataSeries = parsedDataSeries;
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse resulting data series:", { error });
      return;
    }

    let resultingUnit: string | null;
    try {
      const parsedUnit = JSON.parse(form.get("resultingDataSeriesUnit") as string) as JSONValue;

      if (typeof parsedUnit === "string") {
        resultingUnit = parsedUnit;
      } else if (parsedUnit === null) {
        resultingUnit = null;
      } else {
        throw new Error("Parsed data series unit is not a string or null");
      }
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse resulting data series unit:", { error });
      return;
    }

    let recipeUsed: Recipe | undefined;
    try {
      const unparsedRecipe = form.get("resultingRecipe");
      if (unparsedRecipe instanceof File) {
        setIsLoading(false);
        throw new Error("Why is this a file?");
      }
      if (!unparsedRecipe) {
        throw new Error("Failed to parse recipe from form data");
      }
      recipeUsed = Recipe.deserialize(unparsedRecipe);
      if (!recipeUsed) {
        throw new Error("Failed to parse recipe from form data");
      }
    }
    catch (error) {
      setIsLoading(false);
      console.error("Failed to parse recipe:", { error });
      return;
    }

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

      dataSeriesId: undefined,
      dataSeries: { dateValues: resultingDataSeries, unit: resultingUnit },
      dataSeriesRecipeId: undefined,
      dataSeriesRecipe: recipeUsed.serialize(),

      recipeSuggestions: undefined,

      // TODO: scale baseline
      baseline: undefined,
      baselineId: undefined,
      baselineRecipeId: undefined,
      baselineRecipe: undefined,

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
        className="seagreen color-purewhite smooth padding-block-50 padding-inline-100 smooth flex-grow-100 font-size-75 line-height-150"
        onClick={() => openModal(modalRef)}
        style={{ padding: '.3rem .6rem' }}
      >
        {t("components:copy_and_scale.copy_and_scale")}
      </button>

      {/* Modal */}
      <dialog ref={modalRef} aria-modal={true} className={`rounded padding-inline-0 padding-block-0 ${styles.dialog}`}>
        <div className={`${styles['dialog-content']}`}>
          <div className={`${styles['dialog-header']}`}>
            <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus={true} aria-label={t("common:tsx.close")} >
              <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
            </button>
            <h2 className="margin-0">{t("components:copy_and_scale.title", { goalName: goal.name })}</h2>
          </div>

          <div className={`${styles['dialog-body']}`}>
            <form action={formSubmission} name="copyAndScale">

              {/* Roadmap version select */}
              <label className="block margin-block-100">
                {t("components:copy_and_scale.select_roadmap_version")}
                <select className="block margin-block-25 width-100" required={true} name="copyTo" id="copyTo">
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
                    allowValueEditing: true,
                  }}
                />

                <FormIntegration
                  DataSeriesFormElement={<input name="resultingDataSeries" />}
                  UnitFormElement={<input name="resultingDataSeriesUnit" />}
                  RecipeFormElement={<input name="resultingRecipe" />}
                />
              </RecipeContextProvider>

              <button className="block seagreen color-purewhite smooth width-100 margin-inline-auto font-weight-500">
                {t("components:copy_and_scale.create_scaled_copy")}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}