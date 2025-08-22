// import { Years, GoalCreateInput } from "@/types";
import { DataSeries, Goal } from "@prisma/client";

/** 
 * ## DEPRECATED - use recipes instead
 * TODO: remove this
 */
export default function goalInputFromGoalArray(goals: (Goal & { dataSeries: DataSeries | null } | null)[], roadmapId: string, combinationScale?: string | null) {
  // const output: GoalCreateInput[] = [];
  return [];

  // for (const goal of goals || []) {
  //   if (!goal || !goal.dataSeries) {
  //     continue;
  //   }
  //   const dataSeries: (number | null)[] = [];
  //   for (const i of Years) {
  //     // TODO: multiply by combinationScale
  //     const value = goal.dataSeries[i];
  //     dataSeries.push(value);
  //   }

  //   output.push({
  //     name: goal.name ?? undefined,
  //     description: goal.description ?? undefined,
  //     indicatorParameter: goal.indicatorParameter,
  //     dataSeriesArray: dataSeries,
  //     rawDataSeries: dataSeries,
  //     dataUnit: goal.dataSeries.unit,
  //     inheritFrom: [{ id: goal.id }],
  //     roadmapId: roadmapId,
  //   })
  // }

  // return output
}