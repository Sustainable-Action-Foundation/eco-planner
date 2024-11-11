'use client';

import { dataSeriesPattern } from "@/components/forms/goalForm/goalForm";
import formSubmitter from "@/functions/formSubmitter";
import { dataSeriesDataFieldNames, EffectInput } from "@/types";
import { ActionImpactType, DataSeries, Effect } from "@prisma/client";

export default function EffectForm({
  actionId,
  goalId,
  currentEffect,
}: {
  actionId?: string,
  goalId?: string,
  currentEffect?: Effect & {
    dataSeries: DataSeries | null,
  },
}) {
  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.target);

    const dataSeriesInput = formData.get("dataSeries");
    const selectedAction = formData.get("actionId") || actionId;
    const selectedGoal = formData.get("goalId") || goalId;
    const impactType = formData.get("impactType");

    if (!(
      typeof dataSeriesInput === "string" &&
      typeof selectedAction === "string" &&
      typeof selectedGoal === "string" &&
      typeof impactType === "string" &&
      impactType in ActionImpactType
    )) {
      event.target.reportValidity();
      if (!selectedAction || !selectedGoal) {
        alert("Missing action or goal ID");
      }
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

    formSubmitter('/api/effect', formJSON, currentEffect ? 'PUT' : 'POST');
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
        <button type="submit" disabled={true} style={{ display: 'none' }} aria-hidden={true} />
        {/* TODO: Select action and goal if they're missing */}

        <label className="block margin-block-75">
          Dataserie:
          {/* TODO: Make this allow .csv files and possibly excel files */}
          <input type="text" name="dataSeries" required id="dataSeries"
            pattern={dataSeriesPattern}
            title="Använd numeriska värden separerade med semikolon eller tab. Decimaltal kan använda antingen punkt eller komma."
            className="margin-block-25"
            defaultValue={dataSeriesString}
          />
        </label>

        {/* TODO: Show preview of how it would affect the goal */}
        <label className="block margin-block-75">
          Vilken typ av påverkan har åtgärden?
          <select name="impactType" id="impactType" required
            defaultValue={currentEffect?.impactType || ActionImpactType.ABSOLUTE}
          >
            <option value={ActionImpactType.ABSOLUTE}>Absolut skillnad gentemot baslinje</option>
            <option value={ActionImpactType.DELTA}>Förändring år för år (delta)</option>
            <option value={ActionImpactType.PERCENT}>Skillnad gentemot baslinjen i procent av föregående års totalvärde (baslinje + åtgärder)</option>
          </select>
        </label>

        <input type="submit" className="margin-block-75 seagreen color-purewhite" value={currentEffect ? "Spara" : "Skapa åtgärd"} />
      </form>
    </>
  )
}