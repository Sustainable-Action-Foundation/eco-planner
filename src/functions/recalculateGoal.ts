import scbAreaQuery from "@/lib/scbAreaQuery";
import scbPopulationQuery from "@/lib/scbPopulationQuery";
import { AdvancedScalingValue, dataSeriesDataFieldNames, DataSeriesDataFields, isScalingRecipie, ScaleBy, ScaleMethod, SimpleScalingValue } from "@/types";
import { DataSeries } from "@prisma/client";

/** Returns area of childArea / area of parentArea, or 1 if either is not found */
export async function getAreaRatio(parentAreaCode: string, childAreaCode: string) {
  const queryResult = await scbAreaQuery(childAreaCode, parentAreaCode);

  if (queryResult?.area && queryResult?.parentArea) {
    const childArea = parseFloat(queryResult.area);
    const parentArea = parseFloat(queryResult.parentArea);
    const ratio = childArea / parentArea;
    if (Number.isFinite(ratio)) {
      return ratio
    }
  }
  return 1
}

/** Returns population of childArea / population of parentArea, or 1 if either is not found */
export async function getPopulationRatio(parentAreaCode: string, childAreaCode: string) {
  const queryResult = await scbPopulationQuery(childAreaCode, parentAreaCode);

  if (queryResult?.population && queryResult?.parentPopulation) {
    const childPopulation = parseFloat(queryResult.population);
    const parentPopulation = parseFloat(queryResult.parentPopulation);
    const ratio = childPopulation / parentPopulation;
    if (Number.isFinite(ratio)) {
      return ratio
    }
  }
  return 1
}

/** Returns value and weight from an entry, calculating it for advanced scaling values */
async function parseEntry(entry: SimpleScalingValue | AdvancedScalingValue) {
  let weight: number;
  let value: number;
  switch (entry.type) {
    case ScaleBy.Area:
      weight = Number.isFinite(entry.weight) && entry.weight !== undefined ? entry.weight : 1;
      value = await getAreaRatio(entry.parentArea, entry.childArea);
      break;
    case ScaleBy.Inhabitants:
      weight = Number.isFinite(entry.weight) && entry.weight !== undefined ? entry.weight : 1;
      value = await getPopulationRatio(entry.parentArea, entry.childArea);
      break;
    case ScaleBy.Custom:
    default:
      if (!Number.isFinite(entry.value)) {
        return undefined;
      }
      value = entry.value;
      weight = Number.isFinite(entry.weight) && entry.weight !== undefined ? entry.weight : 1;
      break;
  }
  return { value, weight }
}

/**
 * Returns on object with updated data fields for a dataSeries
 */
export async function recalculateGoal(goal: {
  combinationScale: string | null,
  combinationParents: {
    isInverted: boolean,
    parentDataSeries: DataSeries,
  }[]
}) {
  if (!goal || goal.combinationParents.length == 0) {
    return undefined;
  }

  // Get scale from `combinationScale`
  let scaleFactor = 1;
  if (goal.combinationScale) {
    const combinationScale = JSON.parse(goal.combinationScale)

    // If it parses as a number, use it as scale
    if (typeof combinationScale == "number") {
      scaleFactor = combinationScale;
    }
    // Otherwise, find each individual value and then calculate scale factor depending on method
    else if (isScalingRecipie(combinationScale) && combinationScale.values.length > 0) {
      let totalWeight: number;
      switch (combinationScale.method) {
        // Get weighted algeabraic mean of the values
        case ScaleMethod.Algebraic:
          totalWeight = 0;
          scaleFactor = 0;

          for (const entry of combinationScale.values) {
            const parsedEntry = await parseEntry(entry);
            if (parsedEntry == undefined) {
              continue;
            }
            // Increase values
            totalWeight += Math.abs(parsedEntry.weight);
            scaleFactor += parsedEntry.value * Math.abs(parsedEntry.weight);
          }

          // If the total weight is not 0, divide the scale factor by it to get the weighted average
          if (totalWeight != 0) {
            scaleFactor /= totalWeight;
          }
          break;
        // Multiply all scalars together
        case ScaleMethod.Multiplicative:
          // Ignore weights for multiplicative scaling
          scaleFactor = 1;

          for (const entry of combinationScale.values) {
            const parsedEntry = await parseEntry(entry);
            if (parsedEntry == undefined) {
              continue;
            }
            // Increase values
            scaleFactor *= parsedEntry.value;
          }
          break;
        // Get weighted geometric average of scalars
        // See https://en.wikipedia.org/wiki/Weighted_geometric_mean for formula
        case ScaleMethod.Geometric:
        default:
          totalWeight = 0;
          scaleFactor = 1;

          for (const entry of combinationScale.values) {
            const parsedEntry = await parseEntry(entry);
            if (parsedEntry == undefined) {
              continue;
            }
            // Increase values
            totalWeight += Math.abs(parsedEntry.weight);
            scaleFactor *= Math.pow(parsedEntry.value, Math.abs(parsedEntry.weight));
          }

          scaleFactor = Math.pow(scaleFactor, (1 / totalWeight))
          break;
      }
    }
  }

  // Set scale factor to 1 of it is 0 or NaN
  scaleFactor ||= 1

  const outputSeries: Partial<DataSeriesDataFields> = {};
  // MULTIPLY ALL VALUES FROM `combinationParents` WITH EACH OTHER AND SCALE
  for (const i of dataSeriesDataFieldNames) {
    let value: number | null = null;
    for (const parent of goal.combinationParents) {
      // Skip current parent if it has no dataSeries
      if (!parent.parentDataSeries) {
        continue;
      }
      // But if it has a data series but no value, set value to null and break inner loop, as we can't calculate the product if factors are missing
      // Doesn't break outer for-loop
      else if (parent.parentDataSeries[i] == null) {
        value = null;
        break;
      }

      if (value == null) {
        value = parent.isInverted ? (1 / parent.parentDataSeries[i]) : parent.parentDataSeries[i];
      } else {
        value *= parent.isInverted ? (1 / parent.parentDataSeries[i]) : parent.parentDataSeries[i];
      }
    }
    // If value is good, multiply by the scale factor, otherwise set it to null
    if (Number.isFinite(value) && value !== null) {
      value *= scaleFactor;
    } else {
      value = null
    }

    outputSeries[i] = value;
  }

  return outputSeries;
}