'use client';

import { useFormTimestamp } from "./useFormTimestamp";
import formSubmitter from "@/functions/formSubmitter";
import type { Action, DateValuesWithUnit, Effect, EffectInput, Goal, MultiRoadmapInstance } from "@/types";
import { EffectFormName } from "@/types/form-names";
import { isDateValuesWithUnit } from "@/types/typeguards";
import { ActionImpactType } from "@/lib/prisma/generated";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { absoluteToDelta, ActionSelector, deltaToAbsolute, GoalSelector } from "../sections/effectFormSections";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import { FormSync, ManualDataSeriesInput, RecipeContextProvider, waitForRecipeFormSyncs } from "@/components/recipe";
import { Recipe } from "@/functions/recipe/recipe";
import { useToast } from "@/components/generic/toast/toastContext.use";
import { useRouter } from "next/navigation";
import { UnitFlags } from "@/types/enums";
import { IconLoader2 } from "@tabler/icons-react";
import styles from '../forms.module.css';
import HydratedForm from "@/components/form/hydratedForm";

export default function EffectForm({
  goal,
  action,
  currentEffect,
  roadmaps,
}: {
  goal?: Goal | null,
  action?: Action | null,
  currentEffect?: Effect | null | undefined,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const timestamp = useFormTimestamp();
  const router = useRouter();
  // While the submit settles the recipe and awaits the API: the button shows
  // it and ignores further clicks (a second submit would create a second effect)
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();

  const [selectedImpactType, setSelectedImpactType] = useState<ActionImpactType>(currentEffect?.impact_type ?? ActionImpactType.ABSOLUTE);
  const [dateValues, setDateValues] = useState<DateValuesWithUnit>(currentEffect?.data_series
    ? dataSeriesToDateValues(currentEffect.data_series)
    : { unit: UnitFlags.Missing, dateValues: {} },
  );

  async function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submit(event);
    }
    catch (err) {
      setIsSubmitting(false);
      throw err;
    }
  }

  /** The submit proper; every early return and the API's error path hand the button back. */
  async function submit(event: React.ChangeEvent<HTMLFormElement>) {
    // The recipe context evaluates on a debounce; wait for its FormSync output
    // to settle so a submit right after an edit doesn't read a stale series.
    await waitForRecipeFormSyncs(event.target);

    const formData = new FormData(event.target);

    const selectedAction = currentEffect?.action_id ?? formData.get(EffectFormName.ActionId);
    const selectedGoal = currentEffect?.goal_id ?? formData.get(EffectFormName.GoalId);
    const impactType = formData.get(EffectFormName.ImpactType);

    // Parse date values (required)
    const resultingDateValuesString = formData.get(EffectFormName.ResultingDateValues) as string | null;
    if (!resultingDateValuesString) {
      console.error("No resulting date values provided in form.");
      event.target.reportValidity();
      setIsSubmitting(false);
      return;
    }

    let dataSeries: DateValuesWithUnit;
    // let dataSeries: DateValuesWithUnit | undefined = undefined;
    try {
      dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
      // Effects share the goal's unit implicitly; stored without one (serializes to null in the db).
      dataSeries.unit = UnitFlags.Unitless;
    }
    catch (err) {
      console.error("Failed to parse resulting date values from form:", err);
      event.target.reportValidity();
      setIsSubmitting(false);
      return;
    }
    // Validate parsed date values
    if (
      !dataSeries
      || !isDateValuesWithUnit(dataSeries)
    ) {
      console.error("Parsed date values from form are invalid:", dataSeries);
      event.target.reportValidity();
      setIsSubmitting(false);
      return;
    }

    if (
      typeof selectedAction !== "string"
      || typeof selectedGoal !== "string"
      || typeof impactType !== "string"
      || !(impactType in ActionImpactType)
    ) {
      event.target.reportValidity();
      setIsSubmitting(false);
      return;
    }

    const formContent: EffectInput = {
      actionId: selectedAction,
      goalId: selectedGoal,
      dataSeries: dataSeries,
      impactType: impactType as ActionImpactType, // TODO: I don't like this
      timestamp,
    };

    /** Where to redirect after submitting the form, unless API returns a location header */
    let defaultLocation: string | undefined;
    if (currentEffect?.action) {
      defaultLocation = `/action/${currentEffect.action.id}`;
    }
    else if (currentEffect?.goal) {
      defaultLocation = `/goal/${currentEffect.goal.id}`;
    }
    else {
      defaultLocation = `/action/${selectedAction}`;
    }

    formSubmitter('/api/effect', JSON.stringify(formContent), currentEffect ? 'PUT' : 'POST', t, setIsSubmitting, defaultLocation, undefined, undefined, addToast, (url) => router.push(url));
  }

  return (
    <HydratedForm onSubmit={(event) => { void handleSubmit(event); }}>
      <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

      <ActionSelector
        action={action ?? currentEffect?.action ?? null}
        roadmaps={roadmaps}
      />
      <GoalSelector
        goal={goal ?? currentEffect?.goal ?? null}
        roadmaps={roadmaps}
      />

      <RecipeContextProvider
        initialRecipe={Recipe.fromManualDateValues(dateValues).serialize()}
      >
        <ManualDataSeriesInput
          id="effect-dataseries"
          label={t("forms:data_series_input.data_series")}
          initialDateValues={dateValues}
        />
        <FormSync DateValuesFormElement={<input name={EffectFormName.ResultingDateValues} />} />
      </RecipeContextProvider>

      {(
        selectedImpactType === ActionImpactType.ABSOLUTE
        || selectedImpactType === ActionImpactType.DELTA
      )
        && (
          <div className="margin-block-100">
            <button
              type="button"
              onClick={() => {
                if (selectedImpactType === ActionImpactType.ABSOLUTE) {
                  setSelectedImpactType(ActionImpactType.DELTA);
                  setDateValues(prev => absoluteToDelta(prev));
                } else {
                  setSelectedImpactType(ActionImpactType.ABSOLUTE);
                  setDateValues(prev => deltaToAbsolute(prev));
                }
              }}
            >
              {selectedImpactType === ActionImpactType.ABSOLUTE
                ? t("forms:effect.to_year_by_year")
                : t("forms:effect.to_absolute")
              }
            </button>
            <br />
            <small>
              {selectedImpactType === ActionImpactType.ABSOLUTE
                ? <Trans
                  i18nKey="forms:effect.to_year_by_year_info"
                  components={{ strong: <strong /> }}
                />
                : <Trans
                  i18nKey="forms:effect.to_absolute_info"
                  components={{ strong: <strong /> }}
                />
              }
            </small>
          </div>
        )
      }

      {/* TODO: Show preview of how it would affect the goal */}
      <label>
        {t("forms:effect.impact_type_label")}
        <select className="block margin-top-25 margin-bottom-100 width-100" name={EffectFormName.ImpactType} id="impactType" required={true}
          value={selectedImpactType}
          onChange={(event) => setSelectedImpactType(event.target.value as ActionImpactType)}
        >
          <option value={ActionImpactType.ABSOLUTE}>{t("forms:effect.impact_types.absolute")}</option>
          <option value={ActionImpactType.DELTA}>{t("forms:effect.impact_types.delta")}</option>
          <option value={ActionImpactType.PERCENT}>{t("forms:effect.impact_types.percent")}</option>
        </select>
      </label>

      <div className="margin-top-400 padding-top-100 margin-bottom-100" style={{ borderTop: '1px solid var(--gray-80)' }}>
        <button
          className="text-align-center seagreen color-purewhite width-100"
          style={{ fontSize: '14px', transform: 'none' }}
          type="submit"
          id="submit-button"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? <IconLoader2 data-pending="true" aria-hidden="true" width={16} height={16} className={styles.spinner} /> : null}
          {currentEffect
            ? t("common:tsx.save")
            : t("forms:effect.create")
          }
        </button>
      </div>

    </HydratedForm>
  );
}