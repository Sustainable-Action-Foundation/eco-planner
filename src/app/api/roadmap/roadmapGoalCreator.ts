import { RoadmapInput, GoalCreateInput, DataSeriesValueFields } from "@/types";
import { Prisma } from "@prisma/client";
import dataSeriesPrep from "@/app/api/goal/dataSeriesPrep";

export default function roadmapGoalCreator(
  roadmap: Omit<RoadmapInput, 'version'> & { goals?: GoalCreateInput[]; },
  author: string,
) {
  if (!roadmap.goals?.length) {
    return undefined;
  }

  const output: Prisma.GoalCreateWithoutRoadmapInput[] = [];

  roadmap.goals.forEach((goal, goalIndex) => {
    // Create data series
    const dataValues: Partial<DataSeriesValueFields> | null = dataSeriesPrep(goal.rawDataSeries ?? []);
    // If the data series is invalid, throw an error
    if (dataValues === null) {
      throw new Error(`Invalid nested data series at index ${goalIndex}`, { cause: 'nestedGoalCreation' })
    }

    // Format and add to output
    output.push({
      name: goal.name,
      description: goal.description,
      indicatorParameter: goal.indicatorParameter,
      dataSeries: {
        create: {
          ...dataValues,
          unit: goal.dataUnit,
          authorId: author,
        },
      },
      author: { connect: { id: author } },
    })
  });

  return output;
}