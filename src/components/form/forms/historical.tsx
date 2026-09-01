"use client";

import HistoricalDataSection from "@/components/form/sections/dataseries/historical";
import {
  GoalFormError,
  parseHistoricalSection,
  resolveHistoricalDataType,
  storedSeriesForGraph,
  useInitializedValues,
} from "@/components/form/forms/goalSections";
import { waitForRecipeFormSyncs } from "@/components/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import formSubmitter from "@/functions/formSubmitter";
import { Recipe, type SerializedRecipe } from "@/functions/recipe";
import type { DateValuesWithUnit, Goal, GoalCreateInput, GoalUpdateInput } from "@/types";
import { GoalDataTarget, HistoricalDataType } from "@/types/enums";
import { useMemo, useRef, useState, type SubmitEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { GoalGraph } from "@/components/graph/graphs/goal/main";
import { getHistoricalDatasetFromRecipe } from "@/functions/getHistoricalDataset";
import { IconTrashXFilled, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

export const HistoricalFormMode = {
  /** Adds historical data to a goal that has none (POST) */
  Create: "CREATE",
  /** Replaces the goal's existing historical data (PUT) */
  Edit: "EDIT",
} as const;
export type HistoricalFormMode = (typeof HistoricalFormMode)[keyof typeof HistoricalFormMode];

export default function HistoricalForm({
  goal,
  mode,
}: {
  goal: Goal;
  mode: HistoricalFormMode;
}) {
  const { t } = useTranslation(["common", "graphs", "forms"]);
  const { addToast } = useToast();
  const router = useRouter();

  // Same wiring as the goal form: the section renders both input types in
  // hidden-not-unmounted fieldsets once visited, with the type lifted here.
  const [historicalDataType, setHistoricalDataType] = useState<HistoricalDataType>(() => resolveHistoricalDataType(goal));
  const initializedHistoricalTypes = useInitializedValues(historicalDataType);
  const [previewHistoricalRecipe, setPreviewHistoricalRecipe] = useState<SerializedRecipe | null>(null);
  const [previewHistoricalSerie, setPreviewHistoricalSerie] = useState<DateValuesWithUnit | null>(null);
  const [timestamp] = useState(() => Date.now());

  const historicalLabel = useMemo(() => {
    if (!previewHistoricalRecipe) return "";
    try {
      return getHistoricalDatasetFromRecipe(Recipe.from(previewHistoricalRecipe)).label ?? "";
    } catch {
      return "";
    }
  }, [previewHistoricalRecipe]);

  const previewGraphSeries = useMemo(() => ({
    main: storedSeriesForGraph(goal.data_series, goal.name ?? t("common:goal_one")), // todo: use full leap param fallback
    baseline: storedSeriesForGraph(goal.baseline, t("graphs:common.baseline_scenario")),
    historical: (goal.data_series && previewHistoricalSerie?.dateValues) ? {
      ...previewHistoricalSerie,
      name: historicalLabel ? t("graphs:common.historical_series", { label: historicalLabel }) : t("common:historical_data"),
    } : undefined,
  }), [previewHistoricalSerie, historicalLabel, t, goal.baseline, goal.data_series, goal.name]);

  // The section's inputs live in a recipe context; its FormSync injects the
  // resulting recipe and date values as hidden fields, read out here on submit.
  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(event.target instanceof HTMLFormElement)) return;
    if (!(event.target.checkValidity())) {
      event.target.reportValidity();
      return;
    }

    // The recipe context evaluates on a debounce; wait for the FormSync
    // outputs to settle so a submit right after an edit doesn't read stale data.
    await waitForRecipeFormSyncs(event.target);

    const formData = new FormData(event.target);

    let historical: DateValuesWithUnit | undefined;
    let historicalRecipe: Recipe | undefined;
    try {
      ({ historical, historicalRecipe } = parseHistoricalSection(formData, t));
    }
    catch (err) {
      if (!(err instanceof GoalFormError)) throw err;
      addToast(err.message, "error", false);
      return;
    }
    // Nothing selected or entered yet
    if (!historicalRecipe) {
      addToast(t("forms:goal.errors.missing_historical_data"), "error", false);
      return;
    }

    const payload = {
      target: GoalDataTarget.Historical,
      goalId: goal.id,
      timestamp: timestamp,
      historical: historical,
      historicalRecipe: historicalRecipe.serialize(),
      historicalRecipeId: goal.historical?.recipe_used?.id ?? undefined,
    } satisfies GoalCreateInput & GoalUpdateInput;

    // Adding a section to an existing goal is a POST; replacing it is a PUT
    formSubmitter("/api/goal", JSON.stringify(payload), mode === HistoricalFormMode.Create ? "POST" : "PUT",
      t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
  }

  return (
    <form onSubmit={(event) => { void handleSubmit(event); }} name="goalForm">
      {/* This hidden submit button prevents submitting by pressing enter, to avoid accidental submission */}
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      <HistoricalDataSection
        goal={goal}
        historicalDataType={historicalDataType}
        setHistoricalDataType={setHistoricalDataType}
        hasInitializedNone={initializedHistoricalTypes.has(HistoricalDataType.None)}
        hasInitializedExternal={initializedHistoricalTypes.has(HistoricalDataType.External)}
        hasInitializedManual={initializedHistoricalTypes.has(HistoricalDataType.Custom)}
        setPreviewHistoricalSerie={setPreviewHistoricalSerie}
        setPreviewHistoricalRecipe={setPreviewHistoricalRecipe}
      />
      <div
        className="margin-top-200 min-width-0"
      >
        <strong className="block font-size-125 font-weight-bold text-align-center margin-0 padding-top-125 margin-bottom-50">{t("forms:goal.preview")}</strong>
        <output
          className="display-block"
          style={{ height: '400px' }}
        >
          {/* TODO: Need preview for values aswell. Probably create a switch between graph and table then tabs in the table to view different series. */}
          <GoalGraph
            chartType="preview"
            series={previewGraphSeries}
          />
        </output>
      </div>
      <div className="margin-top-400 padding-top-100 margin-bottom-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
        <button
          id="submit-button"
          type="submit"
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: "14px", transform: "none" }}
        >
          {t("common:tsx.save_changes")}
        </button>
      </div>

      {mode === HistoricalFormMode.Edit && goal.historical ?
        <DeleteHistoricalData goal={goal} />
        : null}
    </form>
  );
};

/** Clears the goal's historical section (leaving the rest of the goal untouched) after a typed confirmation. */
function DeleteHistoricalData({ goal }: { goal: Pick<Goal, "id"> }) {
  const { t } = useTranslation(["common", "components"]);
  const { addToast } = useToast();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  return (
    <div className="margin-block-100 padding-top-100 min-width-0" style={{ borderTop: "1px solid var(--gray-80)" }}>
      <button
        className="flex gap-50 align-items-center smooth font-size-14px"
        style={{ textShadow: 'none', color: 'white', backgroundColor: "#f03b3b", border: '0', transform: 'none' }}
        type="button"
        data-testid="delete-historical-data"
        onClick={() => dialogRef.current?.showModal()}
      >
        {t("components:table_menu.historical_data_delete")}
        <IconTrashXFilled aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
      </button>
      <dialog
        closedby='any'
        ref={dialogRef}
        className={`rounded padding-inline-0 padding-block-0 dialog`}
        style={{ width: 'min(75ch, 100%)', height: 'calc(-2rem + 50vh)', fontSize: 'initial' }}
      >
        <div className='dialog-content'>
          <div className='dialog-header'>
            <button type="button" className="grid round padding-50 transparent" onClick={() => dialogRef.current?.close()} autoFocus={true} aria-label={t("common:tsx.close")} >
              <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
            </button>
            <h2 className='margin-0'>{t("components:table_menu.historical_data_delete")}?</h2>
          </div>
          {/* A nested form isn't allowed, so the confirmation is a plain fieldset submitted by its button */}
          <div className='dialog-body'>
            <div className="flex-grow-100">
              <p className="margin-0" >
                <Trans
                  i18nKey={"components:confirm_delete.confirmation"}
                  values={{ targetName: t("components:table_menu.historical_data") }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <label className="block margin-block-75">
                <Trans
                  i18nKey={"components:confirm_delete.type_to_confirm"}
                  values={{ targetName: t("components:table_menu.historical_data") }}
                  components={{ strong: <strong /> }}
                />
                <input
                  className="margin-block-25"
                  type="text"
                  data-testid="delete-historical-data-confirm"
                  // Not part of the surrounding form's submission
                  form=""
                  onChange={(e) => e.target.setCustomValidity(e.target.value === t("components:table_menu.historical_data") ? "" : t("components:confirm_delete.mismatch"))}
                />
              </label>
            </div>
            <div className="flex gap-25">
              <button type="button" className="font-weight-500 flex-grow-100" onClick={() => dialogRef.current?.close()}>{t("common:tsx.cancel")}</button>
              <button
                type='button'
                className="color-purewhite red font-weight-500"
                data-testid="delete-historical-data-submit"
                onClick={(e) => {
                  const input = e.currentTarget.closest('.dialog-body')?.querySelector('input');
                  if (!(input instanceof HTMLInputElement) || input.value !== t("components:table_menu.historical_data")) {
                    input?.reportValidity();
                    return;
                  }
                  // Clear only the historical section, leaving the rest of the goal untouched.
                  formSubmitter('/api/goal', JSON.stringify({
                    target: GoalDataTarget.Historical,
                    goalId: goal.id,
                    timestamp: Date.now(),
                    historicalId: null,
                    historical: null,
                    historicalRecipeId: null,
                    historicalRecipe: null,
                  } satisfies GoalUpdateInput), 'PUT', t, undefined, undefined, undefined, undefined, addToast, (url) => router.push(url));
                }}
              >
                {t("components:table_menu.historical_data_delete")}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
