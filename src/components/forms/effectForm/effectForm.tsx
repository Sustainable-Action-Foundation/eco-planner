'use client';

import { ActionSelector, GoalSelector } from "./effectFormSections";
import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm";
import formSubmitter from "@/functions/formSubmitter";
import { dataSeriesDataFieldNames, EffectInput } from "@/types";
import { ActionImpactType, DataSeries, Effect } from "@prisma/client";
import type getOneAction from "@/fetchers/getOneAction.ts";
import type getOneGoal from "@/fetchers/getOneGoal.ts";
import type getRoadmaps from "@/fetchers/getRoadmaps.ts";

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
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const selectedAction = currentEffect?.actionId || action?.id || formData.get("actionId");
    const selectedGoal = currentEffect?.goalId || goal?.id || formData.get("goalId");
    const dataSeriesInput = formData.get("dataSeries");
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

    // Convert the data series to an array of numbers in string format, the actual parsing is done by the API
    const dataSeries = dataSeriesInput.replaceAll(',', '.').split(/[\t;]/);

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

    formSubmitter('/api/effect', formJSON, currentEffect ? 'PUT' : 'POST', undefined, defaultLocation);
  }

  const timestamp = Date.now();

  // If there is a data series, convert it to an array of numbers to use as a default value in the form
  const dataArray: (number | null)[] = [];
  if (currentEffect?.dataSeries) {
    for (const i of dataSeriesDataFieldNames) {
      dataArray.push(currentEffect.dataSeries[i]);
    }
  }
  const dataSeriesString = dataArray.join(';');

  return (
    <>
      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={true} className="display-none" aria-hidden={true} />

        <ActionSelector action={action} roadmapAlternatives={roadmapAlternatives} />

        <GoalSelector goal={goal} roadmapAlternatives={roadmapAlternatives} />

        <label className="block margin-block-100">
          Dataserie
          {/* TODO: Make this allow .csv files and possibly excel files */}
          <input type="text" name="dataSeries" required id="dataSeries"
            pattern={dataSeriesPattern}
            title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
            className="margin-block-25"
            defaultValue={dataSeriesString}
          />
        </label>

        {/* TODO: Show preview of how it would affect the goal */}
        <label className="block margin-block-100">
          Vilken typ av påverkan har åtgärden?
          <select className="block margin-block-25" name="impactType" id="impactType" required
            defaultValue={currentEffect?.impactType || ActionImpactType.ABSOLUTE}
          >
            <option value={ActionImpactType.ABSOLUTE}>Absolut skillnad gentemot baslinje</option>
            <option value={ActionImpactType.DELTA}>Förändring år för år (delta)</option>
            <option value={ActionImpactType.PERCENT}>Skillnad gentemot baslinjen i procent av föregående års totalvärde (baslinje + åtgärder)</option>
          </select>
        </label>

        <input type="submit" className="margin-block-200 seagreen color-purewhite" value={currentEffect ? "Spara" : "Skapa effekt"} />
      </form>
    </>
  )
}