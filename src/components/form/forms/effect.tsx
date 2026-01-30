'use client';

import formSubmitter from "@/functions/formSubmitter";
import { DateValuesWithUnit, Effect, EffectInput, MultiRoadmapInstance } from "@/types";
import { ActionImpactType } from "@prisma/client";
import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import DateValuesInput from "../elements/dataSeriesInput/dateValuesInput";
import { absoluteToDelta, ActionSelector, deltaToAbsolute, GoalSelector } from "../sections/effectFormSections";
import { dataSeriesToDateValues } from "@/functions/recipe/extractors";

export default function EffectForm({
  effect,
  roadmaps,
}: {
  effect: Effect | null,
  roadmaps: MultiRoadmapInstance[],
}) {
  const { t } = useTranslation(["forms", "common"]);
  const timestamp = useMemo(() => Date.now(), []);

  const [selectedImpactType, setSelectedImpactType] = useState<ActionImpactType>(effect?.impactType ?? ActionImpactType.ABSOLUTE);
  const [dateValues, setDateValues] = useState<DateValuesWithUnit>(effect?.dataSeries
    ? dataSeriesToDateValues(effect.dataSeries)
    : { unit: undefined, dateValues: {}, }
  );

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const selectedAction = effect?.actionId ?? formData.get("actionId");
    const selectedGoal = effect?.goalId ?? formData.get("goalId");
    const impactType = formData.get("impactType");

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
      dataSeries: dateValues, // Gotten as state, not form input
      impactType: impactType as ActionImpactType, // TODO: I don't like this
      timestamp,
    };

    /** Where to redirect after submitting the form, unless API returns a location header */
    let defaultLocation: string | undefined = undefined;
    if (effect?.action) {
      defaultLocation = `/action/${effect.action.id}`;
    }
    else if (effect?.goal) {
      defaultLocation = `/goal/${effect.goal.id}`;
    }
    else {
      defaultLocation = `/action/${selectedAction}`;
    }

    formSubmitter('/api/effect', JSON.stringify(formContent), effect ? 'PUT' : 'POST', t, undefined, defaultLocation);
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <ActionSelector
          action={effect?.action ?? null}
          roadmaps={roadmaps}
        />
        <GoalSelector
          goal={effect?.goal ?? null}
          roadmaps={roadmaps}
        />

        <DateValuesInput
          dateValues={dateValues}
          dateValuesSetter={setDateValues}

          label={t("forms:data_series_input.data_series")}
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
            {effect
              ? t("common:tsx.save")
              : t("forms:effect.create")
            }
          </button>
        </div>

      </form>
    </>
  )
}