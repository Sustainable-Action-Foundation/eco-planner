import { DataSeriesValueFields, isFullDataSeriesValueFields, isPartialDataSeriesValueFields, Years } from "@/types";

/**
 * Parses an object containing a string array called dataSeries into the format needed to create a data series.
 * 
 * Returns null if the data series is invalid.
 * @param parent object containing the data series
 * @returns an object containing the data fields (the ones prefixed with `val`) in a DataSeries or `null`
 */
export default function dataSeriesPrep(
  dataSeries: Partial<DataSeriesValueFields> | string[],
) {
  const cleanedDataSeries: Partial<DataSeriesValueFields> = {};

  // If the data series is already a DataSeriesValueFields object, clean it and return it
  if (!Array.isArray(dataSeries) && isPartialDataSeriesValueFields(dataSeries)) {
    for (const year of Years) {
        cleanedDataSeries[year] = dataSeries[year] ?? null;
    }
    if (!isFullDataSeriesValueFields(cleanedDataSeries)) {
      console.error("Failed to transform data series into a full DataSeriesValueFields object in dataSeriesPrep");
      return null;
    }
    return cleanedDataSeries;
  }

  if (!Array.isArray(dataSeries) || !dataSeries.length) {
    console.error("Data series is not a valid array in dataSeriesPrep");
    return null;
  }

  if (dataSeries.length > Years.length) {
    console.error("Data series length exceeds expected length in dataSeriesPrep");
    return null;
  }

  // Convert string array to DataSeriesValueFields object
  if (dataSeries.length <= Years.length) {
    const dataSeriesCopy = [...dataSeries];

    if (dataSeriesCopy.length < Years.length) {
      const oldLength = dataSeriesCopy.length;
      dataSeriesCopy.length = Years.length;
      dataSeriesCopy.fill("", oldLength);
    }

    // The keys for the data values are `val2020`, `val2021`, etc. up to `val2050`
    const keys = dataSeriesCopy.map((_, index) => Years[index]);
    keys.forEach((key, index) => {
      let value: number | null = parseFloat(dataSeriesCopy[index]);
      // If the value is empty, infinite, or NaN, set it to null
      if (dataSeriesCopy[index] == null || !Number.isFinite(value)) {
        value = null;
      }
      // If the value is a number or null, add it to the dataValues object
      if (value === null || Number.isFinite(value)) {
        cleanedDataSeries[key] = value;
      }
    });
  }
  // If the data series is invalid, return null
  else {
    return null;
  }

  // Type guard it into a non partial DataSeriesValueFields
  if (!isFullDataSeriesValueFields(cleanedDataSeries)) {
    console.error("Failed to transform data series into a full DataSeriesValueFields object in dataSeriesPrep");
    return null;
  }

  return cleanedDataSeries;
}