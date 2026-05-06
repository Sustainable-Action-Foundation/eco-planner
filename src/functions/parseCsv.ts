import { isISOIshDate } from "@/types";
import type { DateValues, GoalCreateInput, ISOIshDate } from "@/types";

export default function parseCsv(csv: ArrayBuffer): string[][] {
  // Despite Windows-1252 being more common than UTF-8 in a Windows/Microsoft environment (such as when exporting CSV files from Excel),
  // we'll use UTF-8 because of its greater support for different characters and non-Latin scripts
  const decoder = new TextDecoder('utf-8');
  const decodedCsv = decoder.decode(csv);
  const rows = decodedCsv.split('\n');
  return rows.map(row => row.split(';'));
}

/**
 * Requires headers to be on the first or third row and throws if any of the required headers are missing
 * @param csv A 2D array of strings
 * @param scaleWarningCallback A function to call if the CSV contains a column for the deprecated "Scale" header
 */
export function csvToGoalList(csv: string[][], scaleWarningCallback?: () => void): GoalCreateInput[] {
  // Remove first two rows if the second row is empty (as it should be, with first row containing metadata and third row containing headers)
  if (!csv[1][0]) {
    csv = csv.slice(2);
  }

  /** Header row from the CSV */
  const headers = csv[0];

  /** Format: `ourHeaderName: csvHeaderName` */
  const nonNumericHeaders = {
    "indicatorParameter": "Branch Path",
    "dataUnit": "Units",
  };
  const definedYears = headers.filter(h => h.length === 4 && Number.isFinite(parseInt(h)));

  // Unsupported header which might be present in the CSV
  const scaleHeaderName = "Scale";
  if (headers.includes(scaleHeaderName) && scaleWarningCallback) {
    scaleWarningCallback();
  }

  const headerIndex: Record<string, number | undefined> = {};
  const output: GoalCreateInput[] = [];

  // Check that all headers are present and get their indices
  for (const headerName of Object.keys(nonNumericHeaders)) {
    if (!headers.includes(nonNumericHeaders[headerName as keyof typeof nonNumericHeaders])) {
      throw new Error(`Missing header "${nonNumericHeaders[headerName as keyof typeof nonNumericHeaders]}"`);
    } else {
      headerIndex[headerName] = headers.indexOf(nonNumericHeaders[headerName as keyof typeof nonNumericHeaders]);
    }
  }

  for (const year of definedYears) {
    headerIndex[year] = headers.indexOf(year);
  }

  // Create GoalInput objects from the data
  for (let i = 1; i < csv.length; i++) {
    // Skip rows without an indicatorParameter
    if (!csv[i][headerIndex["indicatorParameter"] ?? NaN]) {
      continue;
    }

    const dateValues: DateValues = {};
    for (const yyyy of definedYears) {
      const isoDate: string = `${yyyy}-01-01T00:00:00Z`;
      if (!isISOIshDate(isoDate)) throw new Error(`Invalid ISOIshDate generated from year: ${yyyy}`);

      const yearIndex = headerIndex[yyyy];
      if (typeof yearIndex === "undefined") throw new Error(`Header index for year ${yyyy} is undefined`);

      const valueStr = csv[i][yearIndex].replaceAll(",", ".");
      const valueNum = parseFloat(valueStr);
      dateValues[isoDate] = valueNum;
    }

    output.push({
      name: undefined,
      description: undefined,
      indicatorParameter: csv[i][headerIndex["indicatorParameter"] ?? NaN],
      isFeatured: undefined,
      externalDataset: undefined,
      externalTableId: undefined,
      externalSelection: undefined,
      recipeSuggestions: undefined,
      dataSeriesId: undefined,
      dataSeries: {
        dateValues: dateValues,
        unit: csv[i][headerIndex["dataUnit"] ?? NaN],
      },
      dataSeriesRecipeId: undefined,
      dataSeriesRecipe: undefined,
      baselineId: undefined,
      baseline: {
        dateValues: Object.fromEntries(definedYears.map(yyyy => (
          [yyyy, dateValues[definedYears[0] as ISOIshDate]]
        ))),
        unit: null,
      },
      baselineRecipeId: undefined,
      baselineRecipe: undefined,
      rawTags: undefined,
      links: undefined,
      roadmapId: "", // Will be assigned later :O
    })
  }

  return output;
}