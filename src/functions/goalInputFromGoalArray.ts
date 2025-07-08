import { dataSeriesDataFieldNames, GoalCreateInput } from "@/types";
import { DataSeries, Goal } from "@prisma/client";


export default function goalInputFromGoalArray(goals: (Goal & { dataSeries: DataSeries | null } | null)[], combinationScale?: string | null) {
  const output: GoalCreateInput[] = [];

  for (const goal of goals || []) {
    if (!goal || !goal.dataSeries) {
      continue;
    }
    const dataSeries: string[] = [];
    for (const i of dataSeriesDataFieldNames) {
      // TODO: multiply by combinationScale
      const value = goal.dataSeries[i];
      dataSeries.push(value?.toString() || "");
    }

    output.push({
      name: goal.name ?? undefined,
      description: goal.description ?? undefined,
      indicatorParameter: goal.indicatorParameter,
      dataSeries: dataSeries,
      dataUnit: goal.dataSeries.unit,
      inheritFrom: [{ id: goal.id }],
      combinationScale: combinationScale,
    })
  }

  return output
}