"use client";

import DateValuesInput from "@/components/form/elements/dataSeriesInput/dateValuesInput";
import { InheritingBaseline, ManualGoalForm } from "@/components/form/sections/goalFormSections";

export default function Page() {

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    console.log(formData);
  }

  return <section>
    <h1>Test page</h1>

    <form onSubmit={handleSubmit}>
      <InheritingBaseline
        outputFormElement={<input name="inheriting-baseline" />}
      />

      {/* <ManualGoalForm
        outputFormElement={<input name="data-series" />}
      />

      <DateValuesInput
        label="DS"
        outputFormElement={<input name="date-values" />}
      /> */}
    </form>
  </section>
}