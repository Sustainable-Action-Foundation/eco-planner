import fs from 'fs';
import prisma from '../prismaClient.ts';
import { DataSeries } from '@prisma/client';

/**
 * This script generates a json file containing the names of the numeric data fields of data series.
 * The resulting file is used to allow the data series object in the database to change without having
 * to update the code, for example if we want to cover a longer time period.
 */
async function getDataSeriesValueFieldNames() {
  // Get a data series. From it we can extract the names of the numeric data fields.
  const exampleSeries = await prisma.dataSeries.findFirst().catch(() => null);

  // If there are no data series, for example because the database is empty, don't do anything.
  if (!exampleSeries) {
    console.log("No data series found; data series value field names not touched.")
    return;
  }

  // If there are data series, extract the names of the numeric data fields.
  /** A regex that matches the names of the numeric data fields of data series. Works until the year 9999, which seems future-proof enough. */
  const valueFieldRegex = /^val\d{4}$/;
  const dataFields = (Object.keys(exampleSeries) as (keyof DataSeries)[])
    .filter(key => valueFieldRegex.test(key));

  // Write to file
  try {
    fs.writeFileSync('src/lib/dataSeriesCanonicalYears.ts', `

export const Years: (${dataFields.map(field => `"${field}"`).join(' | ')})[]
  = [${dataFields.map(v => `"${v}"`).join(", ")}] as const;

`.trim());

    console.log('Data series value field names updated');
  } catch {
    console.log('Failed to update data series value field names');
  }
}

getDataSeriesValueFieldNames();