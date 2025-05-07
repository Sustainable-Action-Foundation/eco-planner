import { dataSeriesDataFieldNames } from "@/types";

// The amount of years in the data series
const dataSeriesLength = dataSeriesDataFieldNames.length
/**
 * This matches 0 to `dataSeriesLength` numbers separated by tabs or semicolons, with an optional decimal part.
 * The first position represents the value for the first year (currently 2020), and any number in the `dataSeriesLength`:th position
 * represents the value for the last year (currently 2050).
 * 
 * Two examle strings that match this pattern are:  
 * "2.0;2.1;2.2;2.3;2.4;2.5;2.6;2.7;2.8;2.9;3.0;3.1;3.2;3.3;3.4;3.5;3.6;3.7;3.8;3.9;4.0;4.1;4.2;4.3;4.4;4.5;4.6;4.7;4.8;4.9;5.0"  
 * and  
 * ";0;;;4;1"
 */
export const dataSeriesPattern = `(([\\-]?[0-9]+([.,][0-9]+)?)?[\t;]){0,${dataSeriesLength - 1}}([\\-]?[0-9]+([.,][0-9]+)?)?`;

// Finds data series values in a form, either from the dataSeries or from the dataSeriesInput inputs, and returns them as an array of strings
export function getDataSeries(form: HTMLFormControlsCollection, dataSeriesInputName: string = "dataSeries") {
  let values = [];
  
  for (const item of form) {
    if (item instanceof HTMLInputElement && item.name == `${dataSeriesInputName}Input`) {
      values.push(item.value);
    }
  }
  if (values.length == 0) {
    const dataSeriesInput = (form.namedItem(dataSeriesInputName) as HTMLInputElement | null)?.value;
    values = dataSeriesInput ? dataSeriesInput?.replaceAll(',', '.').split(/[\t;]/) : [];
  }

  return values;
}

// TODO - maybe allow "e"?
export function isValidSingleInputForGrid(char: string): boolean {
  // For onBeforeInput – blocks invalid keystrokes
  return /^[0-9.,-]+$/.test(char);
}
export function isValidSingleInputForTextField(char: string): boolean {
  // For onBeforeInput – blocks invalid keystrokes
  return /^[0-9;\t\b.,-]$/.test(char);
}

export function isValidPastedInput(text: string): boolean {
  // For onPaste – allows numbers, semicolons, tabs, whitespace, newlines, commas, dots and minus signs
  return /^[0-9;\t\n\r\s.,-]+$/.test(text);
}