import { getLocalStorage, getSessionStorage, setLocalStorage, setSessionStorage } from "@/functions/localStorage";
import { GraphType } from "../graphGraph";
import { ActionImpactType, type DataSeries, type Effect } from "@prisma/client";
import { Years, DataSeriesValueFields } from "@/types";
import { ChildGraphType } from "../childGraphs/childGraphContainer";

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

/** Retrieves the graph type for gcild graphs for a goal from storage. */
export function getStoredChildGraphType(goalId?: string) {
  let graphType: ChildGraphType | undefined | null;
  // Check if this goal has a stored graph type
  if (goalId) {
    graphType = getSessionStorage(goalId + '_childGraphType') as ChildGraphType | undefined | null;
  }
  // Check if the user has a stored latest graph type if no goalId is provided or the returned graphType is invalid
  if (!graphType || !Object.values(ChildGraphType).includes(graphType as ChildGraphType)) {
    graphType = getLocalStorage("childGraphType") as ChildGraphType | undefined | null;
  }
  // Default to target graph if no valid graph type is found
  if (!graphType || !Object.values(ChildGraphType).includes(graphType as ChildGraphType)) {
    if (graphType != null) {
      console.log("Invalid graph type in storage, defaulting to target graph.");
    }

    setLocalStorage("childGraphType", ChildGraphType.Target);
    graphType = ChildGraphType.Target;
  }
  return graphType;
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
  if (!dataSeries) { return null; }
  for (const i of Years) {
    const value = dataSeries[i];
    if (Number.isFinite(value) && value !== 0) {
      return value;
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
export function calculatePredictedOutcome(effects: (Effect & { dataSeries: DataSeries | null })[], baseline: DataSeries | number) {
  // Early return if no effects and no custom baseline
  if (effects.length < 1 && typeof baseline === 'number') {
    return [];
  }

  // Typecheck and validate baseline
  /** Is used wherever we need to differentiate between the two types of possible baselines */
  const isBaselineNumber = typeof baseline === 'number';
  if (isBaselineNumber && !Number.isFinite(baseline)) {
    return [];
  }
  if (!isBaselineNumber && !Years.every((field) => Object.keys(baseline).includes(field))) {
    return [];
  }

  // Calculate total impact of actions/effects
  const totalEffect: Partial<DataSeriesValueFields> = {};
  for (const i of Years) {
    for (const effect of effects) {
      if (effect.dataSeries && (effect.impactType === ActionImpactType.DELTA)) {
        if (!totalEffect[i]) {
          totalEffect[i] = 0;
        }

        // Add sum of all deltas up to this point for the current action
        let totalDelta = 0;

        for (const j of Years.slice(0, Years.indexOf(i) + 1)) {
          if (effect.dataSeries[j] != null && Number.isFinite(effect.dataSeries[j])) {
            totalDelta += effect.dataSeries[j];
          }
        }

        totalEffect[i] += totalDelta;
      } else if (effect.dataSeries && effect.dataSeries[i] != null && Number.isFinite(effect.dataSeries[i])) {
        if (!totalEffect[i]) {
          totalEffect[i] = 0;
        }
        switch (effect.impactType) {
          case ActionImpactType.DELTA:
            // Delta is handled separately above to account for cases where the current delta is null but some previous deltas are not
            break;
          case ActionImpactType.PERCENT:
            // Add previous year's (baseline + totalEffect) multiplied by current action as percent
            const previous = Years[Years.indexOf(i) - 1];
            if (previous == undefined) {
              break;
            }
            // Substitute with 0 if any value is missing
            // Handle slightly differently depending on type of baseline
            if (isBaselineNumber) {
              totalEffect[i] += ((totalEffect[previous] || 0) + (baseline || 0)) * (effect.dataSeries[i] / 100);
            } else {
              totalEffect[i] += ((totalEffect[previous] || 0) + (baseline[previous] || 0)) * (effect.dataSeries[i] / 100);
            }
            break;
          case ActionImpactType.ABSOLUTE:
          default:
            // Add current value
            totalEffect[i] += effect.dataSeries[i];
            break;
        }
      }
    }
  }

  // Create output array
  const actionOutcome: { x: number, y: number | null }[] = [];

  for (const i of Years) {
    // Set value of baseline depending on its type
    const baselineValue = isBaselineNumber ? (baseline ?? NaN) : (baseline[i] ?? NaN);
    const effectValue = totalEffect[i] || 0;

    const value = baselineValue + effectValue;

    actionOutcome.push({
      x: new Date(i.replace('val', '')).getTime(),
      y: Number.isFinite(value) ? value : null
    })
  }

  return actionOutcome;
}