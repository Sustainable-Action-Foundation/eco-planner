import { isDateValuesWithUnit } from "@/types";
import type { GoalCreateInput } from "@/types";
import type { Prisma } from "@prisma/client";

type RoadmapGoalInput = {
  goals?: GoalCreateInput[] | null | undefined;
};

export default function roadmapGoalCreator(
  roadmap: RoadmapGoalInput,
  author: string,
) {
  if (!roadmap.goals?.length) {
    return undefined;
  }

  const output: Prisma.GoalCreateWithoutRoadmapInput[] = [];

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
      indicatorParameter: goal.indicatorParameter,

      dataSeries: {
        create: {
          ...dataSeries,
          unit: dataSeries.unit,
          authorId: author,
        },
      },

      // TODO: handle providing a DateValuesWithUnit baseline
      ...!goal.baselineId ? {} : {
        baseline: { connect: { id: goal.baselineId } },
      },

      author: { connect: { id: author } },
    });
  });

  return output;
}