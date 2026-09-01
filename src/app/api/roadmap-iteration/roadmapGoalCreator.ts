import { manualDataSeriesCreateData } from "@/functions/recipe/persistence";
import type { Prisma } from "@/lib/prisma/generated";
import type { GoalCreateFull } from "@/types";
import { isDateValuesWithUnit } from "@/types/typeguards";

type RoadmapGoalInput = {
  goals?: GoalCreateFull[] | null | undefined;
};

/**
 * Builds nested goal create inputs for a new/updated roadmap iteration.
 * Each goal's data series is created as manual input: an inline recipe
 * (`meta.isManual`) produces the series, both owned by the iteration's org.
 */
export default function roadmapGoalCreator(
  roadmap: RoadmapGoalInput,
  authorId: string,
  orgId: string,
) {
  if (!roadmap.goals?.length) {
    return undefined;
  }

  const output: Prisma.GoalsCreateWithoutRoadmap_iterationInput[] = [];

  roadmap.goals.forEach((goal, goalIndex) => {
    // Create data series
    const dataSeries = goal.dataSeries;
    // If the data series is invalid, throw an error
    if (!dataSeries || !isDateValuesWithUnit(dataSeries)) {
      throw new Error(`Invalid nested data series at index ${goalIndex}`, { cause: 'nestedGoalCreation' });
    }

    // Format and add to output
    output.push({
      name: goal.name,
      description: goal.description,
      indicator_parameter: goal.indicatorParameter,
      listing: goal.listing,

      data_series: {
        create: manualDataSeriesCreateData(dataSeries, orgId, authorId),
      },

      // TODO: handle providing a DateValuesWithUnit baseline
      // NOTE: the route must check the cross-slot invariant (findClaimedSeries) for these ids
      ...!goal.baselineId ? {} : {
        baseline: { connect: { id: goal.baselineId } },
      },

      author: { connect: { id: authorId } },
    });
  });

  return output;
}
