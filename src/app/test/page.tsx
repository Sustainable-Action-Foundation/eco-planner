// "use client";

import DateValuesInput from "@/components/form/elements/dataSeriesInput/dateValuesInput";
import EffectForm from "@/components/form/forms/effect";
import { InheritingBaseline, ManualGoalForm } from "@/components/form/sections/goalFormSections";
import getRoadmaps from "@/fetchers/getRoadmaps";
import { MultiRoadmapInstance } from "@/types";

export default async function Page() {

  // function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
  //   event.preventDefault();

  //   const formData = new FormData(event.currentTarget);

  //   console.log(formData);
  // }

  const [
    roadmaps,
  ] = await Promise.all([
    getRoadmaps(),
  ]);

  return <section>
    <h1>Test page</h1>

    <EffectForm
      currentEffect={null}
      roadmaps={roadmaps}
    />

    {/* <form onSubmit={handleSubmit}>
      <InheritingBaseline
        outputFormElement={<input name="inheriting-baseline" />}
      />

      <ManualGoalForm
        outputFormElement={<input name="data-series" />}
      />

      <DateValuesInput
        label="DS"
        outputFormElement={<input name="date-values" />}
      />
    </form> */}
  </section>
}