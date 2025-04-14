
export function getDataSeries(form: HTMLFormControlsCollection) {
  let values = [];
  for (const item of form) {
    if (item instanceof HTMLInputElement && item.name == "dataSeriesInput") {
      values.push(item.value);
    }
  }
  if (values.length == 0) {
    const dataSeriesInput = (form.namedItem("dataSeries") as HTMLInputElement | null)?.value;
    values = dataSeriesInput ? dataSeriesInput?.replaceAll(',', '.').split(/[\t;]/) : [];
  }
  return values;
}