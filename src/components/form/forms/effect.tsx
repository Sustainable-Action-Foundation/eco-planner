'use client';

import type getOneAction from "@/fetchers/getOneAction.ts";
import type getOneGoal from "@/fetchers/getOneGoal.ts";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";
import formSubmitter from "@/functions/formSubmitter";
import { Years, EffectInput } from "@/types";
import { ActionImpactType, DataSeries, Effect } from "@prisma/client";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import DateValuesInput from "../elements/dataSeriesInput/dateValuesInput";
import { getDataSeries } from "../elements/dataSeriesInput/utils";
import { absoluteToDelta, ActionSelector, deltaToAbsolute, GoalSelector } from "../sections/effectFormSections";

export default function EffectForm({
  action,
  goal,
  roadmapAlternatives,
  currentEffect,
}: {
  action: Awaited<ReturnType<typeof getOneAction>> | null,
  goal: Awaited<ReturnType<typeof getOneGoal>> | null,
  roadmapAlternatives: Awaited<ReturnType<typeof getRoadmaps>>,
  currentEffect?: Effect & {
    dataSeries: DataSeries | null,
    action: Awaited<ReturnType<typeof getOneAction>> | null,
    goal: Awaited<ReturnType<typeof getOneGoal>> | null,
  },
}) {
  const { t } = useTranslation(["forms", "common"]);

  const [selectedImpactType, setSelectedImpactType] = useState<ActionImpactType>(currentEffect?.impactType || ActionImpactType.ABSOLUTE);
  // Use existing data series converted to a string as a default value
  const [dataSeriesString, setDataSeriesString] = useState<string>(currentEffect?.dataSeries ? Years.map(i => currentEffect.dataSeries?.[i]).join(';') : '');

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const selectedAction = currentEffect?.actionId || action?.id || formData.get("actionId");
    const selectedGoal = currentEffect?.goalId || goal?.id || formData.get("goalId");
    const dataSeriesInput = getDataSeries(event.target.elements).join(";");
    const impactType = formData.get("impactType");

    if (!(
      typeof selectedAction === "string" &&
      typeof selectedGoal === "string" &&
      typeof dataSeriesInput === "string" &&
      typeof impactType === "string" &&
      impactType in ActionImpactType
    )) {
      event.target.reportValidity();
      return;
    }

    // Get the data series as an array of numbers in string format, the actual parsing is done by the API
    const dataSeries = getDataSeries(event.target.elements);

    const formContent: EffectInput & { timestamp: number } = {
      actionId: selectedAction,
      goalId: selectedGoal,
      dataSeries,
      impactType: impactType as ActionImpactType,
      timestamp,
    }

    const formJSON = JSON.stringify(formContent);

    /** Where to redirect after submitting the form, unless API returns a location header */
    let defaultLocation: string | undefined = undefined;
    if (action) {
      defaultLocation = `/action/${action.id}`;
    } else if (goal) {
      defaultLocation = `/goal/${goal.id}`;
    } else {
      defaultLocation = `/action/${selectedAction}`;
    }

    formSubmitter('/api/effect', formJSON, currentEffect ? 'PUT' : 'POST', t, undefined, defaultLocation);
  }

  const timestamp = Date.now();

  // If there is a data series, convert it to an array of numbers to use as a default value in the form
  // const dataArray: (number | null)[] = [];
  // if (currentEffect?.dataSeries) {
  //   for (const i of dataSeriesDataFieldNames) {
  //     dataArray.push(currentEffect.dataSeries[i]);
  //   }
  // }
  // const dataSeriesString = dataArray.join(';');

  return (
    <>
      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <ActionSelector action={action} roadmapAlternatives={roadmapAlternatives} />
        <GoalSelector goal={goal} roadmapAlternatives={roadmapAlternatives} />

        <DateValuesInput
          dataSeriesString={dataSeriesString}
          inputName="dataSeries"
          inputId="dataSeries"
          labelKey="forms:data_series_input.data_series"
        />

        { 
          // TODO: This code can be cleaned up
          selectedImpactType === ActionImpactType.ABSOLUTE ?
            <div className="margin-block-100">
              <button type="button" onClick={() => {
                setSelectedImpactType(ActionImpactType.DELTA);

                const formElement = document?.querySelector('form');
                if (formElement) {
                  setDataSeriesString(absoluteToDelta(getDataSeries(formElement.elements).join(";")));
                }
              }}>
                {t("forms:effect.to_year_by_year")}
              </button> <br />
              <small><Trans
                i18nKey="forms:effect.to_year_by_year_info"
                components={{ strong: <strong /> }}
              /></small>
            </div>
            :
            selectedImpactType === ActionImpactType.DELTA ?
              <div className="margin-block-100">
                <button type="button" onClick={() => {
                  setSelectedImpactType(ActionImpactType.ABSOLUTE);

                  const formElement = document?.querySelector('form');
                  if (formElement) {
                    setDataSeriesString(deltaToAbsolute(getDataSeries(formElement.elements).join(";")));
                  }
                }}>
                  {t("forms:effect.to_absolute")}
                </button>
                <small><Trans
                  i18nKey="forms:effect.to_absolute_info"
                  components={{ strong: <strong /> }}
                /></small>
              </div>
              :
              null
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
            {currentEffect ? t("common:tsx.save") : t("forms:effect.create")}
          </button>
        </div>

      </form>
    </>
  )
}