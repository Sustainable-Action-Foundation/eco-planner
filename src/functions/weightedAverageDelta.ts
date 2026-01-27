import { DataSeries, DateValues, isISOIshDate } from "@/types";
import { dataSeriesToDateValues } from "./recipe/extractors";

const YEARLY_INTEREST_DECAY = 0.1;

/**
 * Returns a number in the range 0–1 representing how "interesting" a data series is.
 * 
 * The number is based on how large the changes are relative to the max change in the series
 * and how close they are in time from now (a change next year is more interesting than a change in 10 years).
 */
export default function dataSeriesInterest(dataSeries: DataSeries): number {
  const currentDate = new Date();

  const dateValues = dataSeriesToDateValues(dataSeries);
  const dates = Object.keys(dateValues.dateValues).sort();
  if (!dates.every(isISOIshDate)) {
    throw new Error("Data series contains non-date keys");
  }
  if (!dates.length) {
    return 0;
  }

  const derivedSeries = derive(dateValues.dateValues);

  let maxAbsDerivative = 0;
  for (const value of Object.values(derivedSeries)) {
    if (Number.isFinite(value)) {
      const absValue = Math.abs(value);
      if (absValue > maxAbsDerivative) {
        maxAbsDerivative = absValue;
      }
    }
  }
  if (maxAbsDerivative === 0) {
    return 0;
  }

  // Finds and weights the most "interesting" point in the series with respect to the max derivative and time decay
  const interests: number[] = [];
  for (const date of Object.keys(derivedSeries)) {
    if (!isISOIshDate(date)) {
      throw new Error("Data series contains non-date keys");
    }
    const value = derivedSeries[date];
    if (Number.isFinite(value)) {
      const year = new Date(date).getUTCFullYear();
      const yearsOut = Math.abs(currentDate.getUTCFullYear() - year);
      const magnitudeScore = Math.abs(value) / maxAbsDerivative;
      const timeScore = Math.pow(1 - YEARLY_INTEREST_DECAY, yearsOut);
      const interest = magnitudeScore * timeScore;
      interests.push(interest);
    }
  }

  // Return average interest
  const averageInterest = interests.reduce((sum, val) => sum + val, 0) / interests.length;
  return averageInterest;
}

function derive(dataSeries: DateValues): DateValues {
  const dates = Object.keys(dataSeries).sort();
  const derived: DateValues = {};

  for (let i = 1; i < dates.length; i++) {
    const currentDate = dates[i];
    const previousDate = dates[i - 1];

    if (!isISOIshDate(currentDate) || !isISOIshDate(previousDate)) {
      throw new Error("Data series contains non-date keys");
    }

    const currentValue = dataSeries[currentDate];
    const previousValue = dataSeries[previousDate];

    if (Number.isFinite(currentValue) && Number.isFinite(previousValue)) {
      const dateDiff = (new Date(currentDate).getTime() - new Date(previousDate).getTime()) / (1000 * 60 * 60 * 24 * 365.24); // difference in days
      derived[currentDate] = (currentValue - previousValue) / dateDiff;
    } else {
      // No-op
    }
  }

  return derived;
}