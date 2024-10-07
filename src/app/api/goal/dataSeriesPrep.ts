import { DataSeriesDataFields, dataSeriesDataFieldNames } from "@/types";

/**
 * Parses an object containing a string array called dataSeries into the format needed to create a data series.
 * 
 * Returns null if the data series is invalid.
 * @param parent object containing the data series
 * @returns an object containing the data fields (the ones prefixed with `val`) in a DataSeries or `null`
 */
export default function dataSeriesPrep(
  dataSeries: string[],
) {
  // Text fields
  const dataValues: Partial<DataSeriesDataFields> = {};
  // Data value fields
  if (dataSeries?.length && dataSeries.length <= dataSeriesDataFieldNames.length) {
    // The keys for the data values are `val2020`, `val2021`, etc. up to `val2050`
    const keys = dataSeries.map((_, index) => dataSeriesDataFieldNames[index]);
    keys.forEach((key, index) => {
      let value: number | null = parseFloat(dataSeries[index]);
      // If the value is empty, set it to null
      if (!dataSeries[index] && dataSeries[index] != "0") {
        value = null;
      }
      // If the value is a number or null, add it to the dataValues object
      if (value === null || Number.isFinite(value)) {
        dataValues[key] = value;
      }
    });
  }
  // If the data series is invalid, return null
  else {
    return null;
  }

  return dataValues;
}