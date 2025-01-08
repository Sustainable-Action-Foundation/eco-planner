import { GoalInput } from "@/types"
import dataSeriesDataFieldNames from "@/lib/dataSeriesDataFieldNames.json" with { type: "json" }

export default function parseCsv(csv: ArrayBuffer): string[][] {
  // Despite Windows-1252 being more common than UTF-8 in a Windows/Microsoft environment (such as when exporting CSV files from Excel),
  // we'll use UTF-8 because of its greater support for different characters and non-Latin scripts
  const decoder = new TextDecoder('utf-8')
  const decodedCsv = decoder.decode(csv)
  const rows = decodedCsv.split('\n')
  return rows.map(row => row.split(';'))
}

/**
 * Requires headers to be on the first or third row and throws if any of the required headers are missing
 * @param csv A 2D array of strings
 */
export function csvToGoalList(csv: string[][]) {
  // Remove first two rows if the second row is empty (as it should be, with first row containing metadata and third row containing headers)
  if (!csv[1][0]) {
    csv = csv.slice(2)
  }

  /** Header row from the CSV */
  const headers = csv[0]

  /** Format: `ourHeaderName: csvHeaderName` */
  const nonNumericHeaders = {
    "indicatorParameter": "Branch Path",
    "dataUnit": "Units",
    "dataScale": "Scale",
  }
  const numericHeaders = []
  for (const year of dataSeriesDataFieldNames) {
    numericHeaders.push(year.replace("val", ""))
  }

  const headerIndex: { [key: string]: number | undefined } = {}
  const output: GoalInput[] = [];

  // Check that all headers are present and get their indices
  for (const i of Object.keys(nonNumericHeaders)) {
    if (!headers.includes(nonNumericHeaders[i as keyof typeof nonNumericHeaders])) {
      if (i === "dataScale") {
        // dataScale is optional, and just used to notify the user that we will ignore all dataScale values
        headerIndex[i] = undefined
        continue
      }
      throw new Error(`Missing header "${nonNumericHeaders[i as keyof typeof nonNumericHeaders]}"`)
    } else {
      headerIndex[i] = headers.indexOf(nonNumericHeaders[i as keyof typeof nonNumericHeaders])
    }
  }

  for (const i of numericHeaders) {
    if (!headers.includes(i)) {
      throw new Error(`Missing header "${i}"`)
    } else {
      headerIndex[i] = headers.indexOf(i)
    }
  }

  // Create GoalInput objects from the data
  for (let i = 1; i < csv.length; i++) {
    // Skip rows without an indicatorParameter
    if (!csv[i][Number(headerIndex.indicatorParameter)]) {
      continue
    }

    const dataSeries: string[] = []
    for (const j of numericHeaders) {
      dataSeries.push(csv[i][Number(headerIndex[j])]?.replaceAll(",", "."))
    }

    output.push({
      indicatorParameter: csv[i][Number(headerIndex.indicatorParameter)],
      dataUnit: csv[i][Number(headerIndex.dataUnit)],
      dataScale: headerIndex.dataScale ? csv[i][headerIndex.dataScale] || undefined : undefined,
      dataSeries,
    })
  }

  return output
}