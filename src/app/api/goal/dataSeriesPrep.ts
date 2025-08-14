import { DataSeriesValueFields, Years } from "@/types";

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
  const dataValues: Partial<DataSeriesValueFields> = {};
  // Data value fields
  if (dataSeries?.length && dataSeries.length <= Years.length) {
    if (dataSeries.length < Years.length) {
      const oldLength = dataSeries.length;
      dataSeries.length = Years.length;
      dataSeries.fill("", oldLength);
    }
    // The keys for the data values are `val2020`, `val2021`, etc. up to `val2050`
    const keys = dataSeries.map((_, index) => Years[index]);
    keys.forEach((key, index) => {
      let value: number | null = parseFloat(dataSeries[index]);
      // If the value is empty, infinite , or NaN, set it to null
      if (dataSeries[index] == null || !Number.isFinite(value)) {
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