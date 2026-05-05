'use client';

import formSubmitter from "@/functions/formSubmitter";
import { isDateValuesWithUnit, type Action, type DateValuesWithUnit, type Effect, type EffectInput, type Goal, type MultiRoadmapInstance } from "@/types";
import { ActionImpactType } from "@prisma/client";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { absoluteToDelta, ActionSelector, deltaToAbsolute, GoalSelector } from "../sections/effectFormSections";
import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";
import DataSeriesInputManual from "../elements/dataSeriesInput/dataSeriesInputManual";
import { useToastContext } from "@/components/generic/toast/toastContext";
import { useRouter } from "next/navigation";

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
  const [timestamp] = useState(() => Date.now());
  const router = useRouter();

  const { addToast } = useToastContext();

  const [selectedImpactType, setSelectedImpactType] = useState<ActionImpactType>(currentEffect?.impactType ?? ActionImpactType.ABSOLUTE);
  const [dateValues, setDateValues] = useState<DateValuesWithUnit>(currentEffect?.dataSeries
    ? dataSeriesToDateValues(currentEffect.dataSeries)
    : { unit: undefined, dateValues: {}, }
  ); 

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const selectedAction = currentEffect?.actionId ?? formData.get("actionId");
    const selectedGoal = currentEffect?.goalId ?? formData.get("goalId");
    const impactType = formData.get("impactType");

    // Parse date values (required)
    const resultingDateValuesString = formData.get("resultingDateValues") as string | null || formData.get("data-series") as string | null; // Fallback for manual data series input
    if (!resultingDateValuesString) {
      console.error("No resulting date values provided in form.");
      event.target.reportValidity();
      return;
    }

    let dataSeries: DateValuesWithUnit;
    // let dataSeries: DateValuesWithUnit | undefined = undefined;
    try {
      dataSeries = JSON.parse(resultingDateValuesString) as DateValuesWithUnit;
      dataSeries.unit = undefined
      // dataSeries.unit = formData.get("dataUnit") as string | null;
    } catch (e) {
      console.error("Failed to parse resulting date values from form:", e);
      event.target.reportValidity();
      return;
    }
    // Validate parsed date values
    if (
      !dataSeries
      || !isDateValuesWithUnit(dataSeries)
    ) {
      console.error("Parsed date values from form are invalid:", dataSeries);
      event.target.reportValidity();
      return;
    }

    if (
      typeof selectedAction !== "string"
      || typeof selectedGoal !== "string"
      || typeof impactType !== "string"
      || !(impactType in ActionImpactType)
    ) {
      event.target.reportValidity();
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

    formSubmitter('/api/effect', JSON.stringify(formContent), currentEffect ? 'PUT' : 'POST', t, undefined, defaultLocation, undefined, undefined, addToast, router.push);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <ActionSelector
          action={action ?? currentEffect?.action ?? null}
          roadmaps={roadmaps}
        />
        <GoalSelector
          goal={goal ?? currentEffect?.goal ?? null}
          roadmaps={roadmaps}
        />
  
        <DataSeriesInputManual
          id="effect-dataseries"
          label={t("forms:data_series_input.data_series")}
          initialDateValues={dateValues}
          outputFormElement={<input name="data-series" />}
        />
 
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
          <select className="block margin-top-25 margin-bottom-100 width-100" name="impactType" id="impactType" required
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
          >
            {currentEffect
              ? t("common:tsx.save")
              : t("forms:effect.create")
            }
          </button>
        </div>

      </form>
    </>
  )
}