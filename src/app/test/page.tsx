"use client";

import DateValuesInput from "@/components/form/elements/dataSeriesInput/dataSeriesInput";

export default function Page() {

  function handleSubmit(event: React.ChangeEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    console.log(formData);
  }

  return <section>
    <h1>Test page</h1>

    <form onSubmit={handleSubmit}>
      <button>sumbit</button>

      <DateValuesInput
        label="DS"
        outputFormElement={<input name="date-values" />}
      />
    </form>
  </section>
}