import { Trans, useTranslation } from "react-i18next";
import { useRecipe } from "../context/recipeContext.use";
import { getRecipeRoadmapData } from "../context/roadmapDataCache";
import { useEffect, useState } from "react";
import { RecipeDataTypes } from "@/functions/recipe/types/enums";
import type { ClientRoadmapIteration } from "@/types";
import { IconCheck } from "@tabler/icons-react";

/**
 * Offers to copy the indicator parameter of the goal(s) whose data series the
 * recipe uses. The parameter input itself sits elsewhere in the form, so on
 * apply it is scrolled into view and focused to show what happened.
 */
export default function ParameterSync({
  setter,
  current,
  inputId,
}: {
  setter: React.Dispatch<React.SetStateAction<string>>;
  /** The form's current indicator parameter, to show when the suggestion is already applied */
  current?: string;
  /** Id of the indicator parameter input, scrolled to and focused after applying */
  inputId?: string;
}) {
  const { variables } = useRecipe();
  const [roadmapData, setRoadmapData] = useState<Record<string, ClientRoadmapIteration> | null>(null);
  const { t } = useTranslation("components");

  useEffect(() => {
    async function fetchRoadmapData() {
      try {
        const { roadmapLookup } = await getRecipeRoadmapData();
        setRoadmapData(roadmapLookup);
      }
      catch (err) {
        console.error("Failed to fetch roadmap data for parameter sync:", err);
      }
    }

    fetchRoadmapData().catch((err: unknown) => {
      console.error("Unexpected error fetching roadmap data for parameter sync:", err);
    });
  }, []);

  if (!roadmapData) return null;

  const dataSeriesIds = variables
    .filter((variable) => variable.type === RecipeDataTypes.DataSeries)
    .map((variable) => variable.dataSeriesId);
  if (dataSeriesIds.length === 0) return null;

  // Indicator parameters of the goals owning the used data series (main, baseline or effect series)
  const resultingParameters = [...new Set(Object.values(roadmapData)
    .flatMap((roadmap) => roadmap.goals)
    .flatMap((goal) => [
      ...(goal.data_series ? [{ id: goal.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
      ...(goal.baseline ? [{ id: goal.baseline.id, indicatorParameter: goal.indicator_parameter }] : []),
      ...goal.effects.flatMap((effect) => effect.data_series ? [{ id: effect.data_series.id, indicatorParameter: goal.indicator_parameter }] : []),
    ])
    .filter((entry) => dataSeriesIds.includes(entry.id))
    .map((entry) => entry.indicatorParameter))];

  // TODO: Allow selecting one of the available parameters when there are several
  if (resultingParameters.length !== 1) return null;
  const resultingParameter = resultingParameters[0];
  const isApplied = current?.trim() === resultingParameter.trim();

  function apply() {
    setter(resultingParameter);
    if (!inputId) return;
    const input = document.getElementById(inputId);
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  }

  return (
    <>
      <p className="margin-top-100 margin-bottom-25">{t("components:recipe_editor.apply_paramater_question")}</p>
      <button
        className="width-100 flex align-items-center justify-content-center gap-25"
        type="button"
        disabled={isApplied}
        onClick={apply}
      >
        {isApplied ? <>
          <IconCheck width={18} height={18} style={{ minWidth: "18px" }} aria-hidden="true" />
          <Trans
            i18nKey="components:recipe_editor.parameter_applied"
            values={{ indicator: resultingParameter }}
            components={{ strong: <strong /> }}
          />
        </> : <Trans
          i18nKey="components:recipe_editor.apply_parameter"
          values={{ indicator: resultingParameter }}
          components={{ strong: <strong /> }}
        />}
      </button>
    </>
  );
}
