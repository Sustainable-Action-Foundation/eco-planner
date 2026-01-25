import { getLocalStorage, getSessionStorage, setLocalStorage, setSessionStorage } from "@/functions/localStorage";
import { GraphType } from "@/components/graphs/graphGraph";
import { ActionImpactType } from "@prisma/client";
import { ChildGraphType } from "@/components/graphs/childGraphs/childGraphContainer";
import { type DateValues, type Effect, type DataSeries, isISOIshDate } from "@/types";

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
      console.log("Invalid graph type in storage, defaulting to main graph.");
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
      console.log("Invalid graph type in storage, defaulting to target graph.");
    }

    setLocalStorage("childGraphType", ChildGraphType.Target);
    graphType = ChildGraphType.Target;
  }
  return graphType as ChildGraphType;
}

/** Stores the graph type for a goal in storage. */
export function setStoredGraphType(graphType: string, goalId?: string) {
  if (goalId) {
    setSessionStorage(goalId + "_graphType", graphType)
  };
  setLocalStorage("graphType", graphType);
}

/** Stores the graph type for child graphs for a goal in storage. */
export function setStoredChildGraphType(graphType: ChildGraphType, goalId?: string) {
  if (goalId) {
    setSessionStorage(goalId + "_childGraphType", graphType)
  };
  setLocalStorage("childGraphType", graphType);
}

/** Returns the first non-null, non-zero value from a data series. If all values are null or zero, returns null. */
export function firstNonNullValue(dataSeries: DataSeries): number | null {
  if (!dataSeries) return null;
  if (dataSeries.values.length < 1) return null;

  if (dataSeries.values.every(v => v.value === null || v.value === 0)) {
    return null;
  }

  const dates = dataSeries.values.map(v => v.timestamp.getUTCFullYear()).sort();

  for (const yyyy of dates) {
    const found = dataSeries.values.find(v => v.timestamp.getUTCFullYear() === yyyy);
    if (found && found.value !== null && found.value !== 0) {
      return found.value;
    }
  }

  return null;
}

/**
 * Calculates predicted outcome based on effects and a baseline (either a data series or a single baseline value).
 * Returns an empty array upon invalid input.
 * 
 * To get relative y-values, divide all values by the first non-zero, non-null y-value (and multiply by 100 if you want percentages).
 * To get delta y-values, subtract the previous y-value from all y-values, preferably back to front to avoid needing a copy of the array.
 */
export function calculatePredictedOutcome(effects: Effect[], baselineValue: DataSeries | number) {
  // Early return if no effects and no custom baseline
  if (effects.length < 1 && typeof baselineValue === 'number') {
    return [];
  }

  // Typecheck and validate baseline
  if (typeof baselineValue === 'number' && !Number.isFinite(baselineValue)) {
    console.warn("Invalid baseline number provided to calculatePredictedOutcome.");
    return [];
  }

  // Calculate total impact of actions/effects
  const totalEffect: DateValues = {};
  const definedDates: string[] = [...new Set(effects
    .filter(effect => effect.dataSeriesId && effect.dataSeries)
    .flatMap(effect => effect.dataSeries?.values.map(v => v.timestamp.getUTCFullYear())))
  ]
    .sort()
    .map(yyyy => `${yyyy}-01-01T00:00:00Z`);

  if (!definedDates.every(t => isISOIshDate(t))) {
    console.warn("Invalid date found in effects data series when calculating predicted outcome.");
    return [];
  }

  // Transform baseline to DateValues even if it's a number for easier calculations later
  const baseline: DateValues = {};
  for (const date of definedDates) {
    if (typeof baselineValue === 'number') {
      baseline[date] = baselineValue;
      continue;
    }
    const found = baselineValue.values.find(v => v.timestamp.getUTCFullYear() === new Date(date).getUTCFullYear());
    if (found) {
      baseline[date] = found.value;
    }
  }

  for (const date of definedDates) {
    for (const effect of effects) {
      const dataSeries: DateValues = {};
      if (effect.dataSeries) {
        for (const entry of effect.dataSeries.values) {
          const isoDate = entry.timestamp.toISOString();
          if (!isISOIshDate(isoDate)) {
            console.warn("Invalid date found in effect data series when calculating predicted outcome.");
            return [];
          }
          dataSeries[isoDate] = entry.value;
        }
      }

      if (
        dataSeries[date]
        && effect.impactType === ActionImpactType.DELTA
      ) {
        totalEffect[date] ??= 0;

        // Add sum of all deltas up to this point for the current action
        let totalDelta = 0;

        for (const previousDate of definedDates.filter(d => new Date(d) <= new Date(date))) {
          if (
            dataSeries[previousDate]
            && Number.isFinite(dataSeries[previousDate])
          ) {
            totalDelta += dataSeries[previousDate];
          }
        }

        totalEffect[date] += totalDelta;
      }
      else if (
        dataSeries[date]
        && Number.isFinite(dataSeries[date])
      ) {
        totalEffect[date] ??= 0;

        switch (effect.impactType) {
          case ActionImpactType.DELTA: break; // Delta is handled separately above to account for cases where the current delta is null but some previous deltas are not
          case ActionImpactType.PERCENT:
            const previousDate = definedDates[definedDates.indexOf(date) - 1];
            if (!previousDate) break;

            // TODO is this equation correct? what is being calculated here?
            // Substitute with 0 if any value is missing
            const prevBaseline = baseline[previousDate] || 0;
            const prevEffect = totalEffect[previousDate] || 0;
            const multiplier = dataSeries[date] / 100;
            totalEffect[date] += (prevBaseline + prevEffect) * multiplier;

            break;

          case ActionImpactType.ABSOLUTE:
          default:
            // Add current value
            totalEffect[date] += dataSeries[date];
            break;
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