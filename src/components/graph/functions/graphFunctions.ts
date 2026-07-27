import { getLocalStorage, getSessionStorage, setLocalStorage, setSessionStorage } from "@/functions/localStorage";
import type { DataSeries, DateValues, DateValuesWithUnit, Effect, Goal, ISOIshDate } from "@/types";
import { ChildGraphType, GraphType, UnitFlags } from "@/types/enums";
import { isISOIshDate } from "@/types/typeguards";
import { ActionImpactType } from "@/lib/prisma/generated";

import { dataSeriesToDateValues } from "@/functions/recipe/vectorAndMaskUtils";

/** Retrieves the graph type for a goal from storage. */
export function getStoredGraphType(goalId?: string) {
  let graphType: GraphType | undefined | null;
  // Check if this goal has a stored graph type
  if (goalId) {
    graphType = getSessionStorage(goalId + '_graphType') as GraphType | undefined | null;
  }
  // Check if the user has a stored latest graph type if no goalId is provided or the returned graphType is invalid
  if (!Object.values(GraphType).includes(graphType as GraphType) || !graphType) {
    graphType = getLocalStorage("graphType") as GraphType | undefined | null;
  }
  // Default to main graph if no valid graph type is found
  if (!Object.values(GraphType).includes(graphType as GraphType) || !graphType) {
    if (graphType != null) {
      console.warn("Invalid graph type in storage, defaulting to main graph.");
    }

    setLocalStorage("graphType", GraphType.Main);
    graphType = GraphType.Main;
  }
  return graphType;
}

/** Retrieves the graph type for child graphs for a goal from storage. */
export function getStoredChildGraphType(goalId?: string): ChildGraphType {
  let graphType: string | undefined | null;
  // Check if this goal has a stored graph type
  if (goalId) {
    graphType = getSessionStorage(goalId + '_childGraphType') as string | undefined | null;
  }
  // Check if the user has a stored latest graph type if no goalId is provided or the returned graphType is invalid
  if (!graphType || !Object.values(ChildGraphType).includes(graphType as ChildGraphType)) {
    graphType = getLocalStorage("childGraphType") as string | undefined | null;
  }
  // Default to target graph if no valid graph type is found
  if (!graphType || !Object.values(ChildGraphType).includes(graphType as ChildGraphType)) {
    if (graphType != null) {
      console.warn("Invalid graph type in storage, defaulting to target graph.");
    }

    setLocalStorage("childGraphType", ChildGraphType.Target);
    graphType = ChildGraphType.Target;
  }
  return graphType as ChildGraphType;
}

/** Stores the graph type for a goal in storage. */
export function setStoredGraphType(graphType: string, goalId?: string) {
  if (goalId) {
    setSessionStorage(goalId + "_graphType", graphType);
  };
  setLocalStorage("graphType", graphType);
}

/** Stores the graph type for child graphs for a goal in storage. */
export function setStoredChildGraphType(graphType: ChildGraphType, goalId?: string) {
  if (goalId) {
    setSessionStorage(goalId + "_childGraphType", graphType);
  };
  setLocalStorage("childGraphType", graphType);
}

/**
 * Calculates predicted outcome based on effects and a baseline (either a data series or a single baseline value).
 * Returns an empty array upon invalid input.
 * 
 * To get relative y-values, divide all values by the first non-zero, non-null y-value (and multiply by 100 if you want percentages).
 * To get delta y-values, subtract the previous y-value from all y-values, preferably back to front to avoid needing a copy of the array.
 */
export function calculatePredictedOutcome(effects: Effect[] | Goal["effects"], baselineValue: DataSeries | number | Goal["baseline"]) {
  if (effects.length < 1) {
    return [];
  }

  if (typeof baselineValue === 'number' && !Number.isFinite(baselineValue)) {
    console.warn("Invalid baseline number provided to calculatePredictedOutcome.");
    return [];
  }

  const definedDates: string[] = [...new Set(effects
    .filter(effect => effect.dataSeries)
    .flatMap(effect => effect.dataSeries?.values.map(v => new Date(v.timestamp).getUTCFullYear()))),
  ]
    .sort((a, b) => (a ?? 0) - (b ?? 0))
    .map(yyyy => `${yyyy}-01-01T00:00:00Z`);

  if (!definedDates.every(t => isISOIshDate(t))) {
    console.warn("Invalid date found in effects data series when calculating predicted outcome.");
    return [];
  }

  // Transform baseline to DateValues even if it's a number for easier calculations later
  const baseline: DateValues = {};
  for (const date of definedDates) {
    if (!baselineValue) continue;
    if (typeof baselineValue === 'number') {
      baseline[date] = baselineValue;
      continue;
    }
    const found = baselineValue.values.find(v => new Date(v.timestamp).getUTCFullYear() === new Date(date).getUTCFullYear());
    if (found) {
      baseline[date] = found.value;
    }
  }

  // Calculate total impact of actions/effects
  const totalEffect: DateValues = {};;

  for (const date of definedDates) {
    const normalizedDate = date.replace(/(:00)Z$/, '$1.000Z') as ISOIshDate;

    for (const effect of effects) {
      const dataSeries = effect.dataSeries
        ? dataSeriesToDateValues(effect.dataSeries)
        : { dateValues: {} as DateValues, unit: UnitFlags.Unitless } satisfies DateValuesWithUnit;

      if (
        dataSeries.dateValues[normalizedDate]
        && effect.impactType === ActionImpactType.DELTA
      ) {

        totalEffect[date] ??= 0;

        // Add sum of all deltas up to this point for the current action
        let totalDelta = 0;

        for (const previousDate of definedDates.filter(d => new Date(d) <= new Date(date))) {
          const normalizedPreviousDate = previousDate.replace(/(:00)Z$/, '$1.000Z') as ISOIshDate;
          if (
            dataSeries.dateValues[normalizedPreviousDate]
            && Number.isFinite(dataSeries.dateValues[normalizedPreviousDate])
          ) {
            totalDelta += dataSeries.dateValues[normalizedPreviousDate]; 
          }
        }

        totalEffect[date] += totalDelta;
      }
      else if (
        dataSeries.dateValues[normalizedDate]
        && Number.isFinite(dataSeries.dateValues[normalizedDate])
      ) {
        totalEffect[date] ??= 0;

        switch (effect.impactType) {
          case ActionImpactType.DELTA: break; // Delta is handled separately above to account for cases where the current delta is null but some previous deltas are not
          case ActionImpactType.PERCENT: {

            const previousDate = definedDates[definedDates.indexOf(date) - 1];
            if (!previousDate) break;

            // TODO is this equation correct? what is being calculated here?
            // Substitute with 0 if any value is missing
            const prevBaseline = baseline[previousDate] || 0;
            const prevEffect = totalEffect[previousDate] || 0;
            const multiplier = dataSeries.dateValues[normalizedDate] / 100;
            totalEffect[date] += (prevBaseline + prevEffect) * multiplier;

            break;
          }
          case ActionImpactType.ABSOLUTE:
          default: {
            // Add current value
            totalEffect[date] += dataSeries.dateValues[normalizedDate];
            break;
          }
        }
      }
    }
  }

  // Create output array
  const actionOutcome: { x: number, y: number | null }[] = [];

  for (const date of definedDates) {
    const baselineAtDate = baseline[date] || 0;
    const effectAtDate = totalEffect[date] || 0;
    const sum = baselineAtDate + effectAtDate;

    actionOutcome.push({
      x: new Date(date).getTime(),
      y: Number.isFinite(sum) ? sum : null,
    });
  }

  return actionOutcome;
}