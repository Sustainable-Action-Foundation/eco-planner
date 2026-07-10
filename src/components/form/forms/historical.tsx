"use client";

import HistoricalDataSection from "@/components/form/sections/dataseries/historical";
import formSubmitter from "@/functions/formSubmitter";
import { getHistoricalSource } from "@/functions/getHistoricalDataset";
import { Recipe } from "@/functions/recipe";
import type { ApiTableMetadata, ApiTableContent } from "@/lib/api/apiTypes";
import { formQueryHelper, isDataSetKeys } from "@/lib/api/utility";
import type { GoalUpdateInput } from "@/types";
import { GoalDataTarget, type Goal } from "@/types";
import { useCallback, useState, type SubmitEvent } from "react";
import { useTranslation } from "react-i18next";

type ExternalDataState = {
  dataSource: string;
  table: { tableId: string; label: string } | null;
  tableMetadata: ApiTableMetadata | null;
  tableContent: ApiTableContent | null;
  mainTimeDimensionId: string | null;
} | null;

export default function HistoricalForm({
  goal,
}: {
  goal: Goal
}) {
  const { t } = useTranslation(["common"]);

  const [externalData, setExternalData] = useState<ExternalDataState>(null);

  const handleHistoricalDataChange = useCallback((data: ExternalDataState) => {
    setExternalData(data);
  }, []);

  const historicalSource = getHistoricalSource(goal);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!externalData) return;

    // Return if insufficient selection has been madetableMetadata
    if (!externalData.table) return;
    // Return if properly formatted response was not found
    if (!externalData.tableContent) return;
    if (!(event.target instanceof HTMLFormElement)) return;

    if (!(event.target.checkValidity())) return;
    if (!isDataSetKeys(externalData.dataSource)) return;

    const formData = new FormData(event.target);
    const query = formQueryHelper(formData, externalData.tableMetadata, externalData.mainTimeDimensionId);

    const recipe = Recipe.fromExternalSource({
      name: externalData.table?.label || externalData.dataSource,
      dataset: externalData.dataSource,
      tableId: externalData.table?.tableId ?? null,
      selection: query,
      variableId: historicalSource?.id,
    });

    formSubmitter("/api/goal", JSON.stringify({
      target: GoalDataTarget.Historical,
      goalId: goal ? goal.id : "",
      historicalRecipe: recipe.serialize(),
      historicalRecipeId: goal?.historical?.recipeUsed?.id ?? undefined,
      timestamp: Date.now(),
    } satisfies GoalUpdateInput), "PUT", t);
  } 

  // TODO: Cannot save manually inputted historical data but except for that this seems to work.
  return (
    <form onSubmit={handleSubmit} name="goalForm">
      <HistoricalDataSection
        onChange={handleHistoricalDataChange}
        goal={goal}
      />
      <div className="margin-top-400 padding-top-100 margin-bottom-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
        <button
          id="submit-button"
          type="submit"
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: "14px", transform: "none" }}
          disabled={!externalData?.tableMetadata || !externalData?.tableContent || !externalData?.dataSource}
        >
          {t("common:tsx.save_changes")}
        </button>
      </div>
    </form>
  );
};