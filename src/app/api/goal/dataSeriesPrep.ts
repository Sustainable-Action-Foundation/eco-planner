import { DataSeriesDataFields, GoalInput, dataSeriesDataFieldNames } from "@/types";

/**
 * Converts GoalInput data into the format needed to create a data series.
 * 
 * Returns null if the data series is invalid.
 * @param goal `GoalInput` object
 * @returns an object containing the data fields (the ones prefixed with `val`) in a DataSeries or `null`
 */
export default function dataSeriesPrep(
  goal: GoalInput,
) {
  // Text fields
  const dataValues: Partial<DataSeriesDataFields> = {};
  // Data value fields
  if (goal.dataSeries?.length && goal.dataSeries.length <= dataSeriesDataFieldNames.length) {
    // The keys for the data values are `val2020`, `val2021`, etc. up to `val2050`
    const keys = goal.dataSeries.map((_, index) => dataSeriesDataFieldNames[index]);
    keys.forEach((key, index) => {
      let value: number | null = parseFloat(goal.dataSeries[index]);
      // If the value is empty, set it to null
      if (!goal.dataSeries[index] && goal.dataSeries[index] != "0") {
        value = null;
      }
      // If the value is a number or null, add it to the dataValues object
      if (value === null || Number.isFinite(value)) {
        dataValues[key] = value;
      }
    });
  }
  // If the data series is invalid, return an error
  else {
    return null;
  }

  return dataValues;
}