import { Years } from "@/types";
import { DataSeries } from "@prisma/client";

/**
 * Returns a number representing how "interesting" a data series is. Bigger numbers are more "interesting".
 * 
 * The number is based on how large the changes are relative to the values (an increase from 1 => 2 is more interesting than 100 => 101)
 * and how close they are in time from now (a change next year is more interesting than a change in 10 years).
 */
export default function dataSeriesInterest(dataSeries: DataSeries) {
  if (!dataSeries) {
    return 0;
  }

  const currentYear = new Date().getFullYear();

  const keys = Years;
  const years = keys.map((key) => parseInt(key.replace('val', '')));

  /**
   * The max weight is twice the maximum number of years away from now in the data series.
   * For example, if a data series goes from 2020 to 2050 and the current year is 2025, the max weight is 50.
   * 
   * The reason for this is that we want changes close to now to weigh more than ones in a long time or a long time ago,
   * and we opted to give ones close in time up to twice the weight of those far away.
   */
  const maxWeight = Math.max(Math.abs(currentYear - Math.min(...years)), Math.abs(currentYear - Math.max(...years))) * 2;

  let previousValue: number | undefined = undefined;
  let previousYearWithValue: number | undefined = undefined;
  let totalWeightedDelta = 0;
  let totalValue = 0;

  for (const key of keys) {
    if (dataSeries[key] == null) {
      continue;
    } else if (previousValue == undefined || previousYearWithValue == undefined) {
      previousValue = dataSeries[key];
      previousYearWithValue = parseInt(key.replace('val', ''));
      continue;
    } else {
      // Create array with all years from (exclusive) previousYearWithValue to the year of the current value (inclusive)
      // This is done in order to handle years with undefined values, by assuming there's a linear change across the missing years. Works just as well with all values defined.
      // We know previousYearWithValue is not null since we checked it earlier
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const relevantYears = Array.from({ length: parseInt(key.replace('val', '')) - previousYearWithValue }, (_, iter) => (previousYearWithValue! + 1) + iter);
      // Total change since last noted value
      const delta = dataSeries[key] - previousValue;
      // Average change per year
      const deltaPerYear = delta / relevantYears.length;
      // Calculate weight for each year involved
      const yearlyWeights = relevantYears.map((year) => maxWeight - Math.abs(currentYear - year));
      // Sum the weights together
      const subTotalWeight = yearlyWeights.reduce((partialWeight, a) => partialWeight + a, 0);
      // Increase totalWeightedDelta by the average change per year multiplied by total weight for the range
      // (= avg delta * avg weight * nr of years)
      totalWeightedDelta += Math.abs(deltaPerYear * subTotalWeight);

      // Get values for each year (assuming linear change if any years are missing values)
      // We use absolute values to allow summing positive and negative values together
      // We know dataSeries[key] is not null since we checked it earlier
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const yearlyValues = relevantYears.map((_, i) => Math.abs(dataSeries[key]! - deltaPerYear * i));
      // increase toatlValue by sum of yearlyValues
      totalValue += yearlyValues.reduce((partialValue, a) => partialValue + a, 0);
    }
  }

  let interest = totalWeightedDelta / totalValue;
  // If interest is infinite or NaN it's because totalValue is 0, which is a very boring data series (the values 1 and -1 would give a totalValue of 2)
  if (!Number.isFinite(interest)) {
    interest = 0;
  }
  return interest;
}