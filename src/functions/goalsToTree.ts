import { DataSeries, Goal } from "@prisma/client";

export type GoalTree = { [key: string]: GoalTree | (Goal & { dataSeries: DataSeries | null } & { roadmap: { id: string, metaRoadmap: { name: string, id: string } } }) };

export default function goalsToTree(goals: ((Goal & { dataSeries: DataSeries | null } & { roadmap: { id: string, metaRoadmap: { name: string, id: string } } }) | null)[]) {
  const tree: GoalTree = {};

  for (const goal of goals) {
    if (!goal) {
      continue;
    }

    const parameters = goal.indicatorParameter.split('\\');

    // "key" and "demand" are currently the first subsection in the parameters of our data exported from LEAP, but they are mainly metadata and not relevant for the tree structure
    if (parameters[0].toLowerCase() == 'key' || parameters[0].toLowerCase() == 'demand') {
      parameters.shift();
    }

    // Create the path to the goal
    let current = tree;
    // Create a subsection for each parameter subsection except the last one, unless there is only one parameter
    // Ignoring the last subsection prevents the creation of many branches with only one leaf each
    for (const parameter of parameters.slice(0, (parameters.length - 1 || 1))) {
      if (!current[parameter]) {
        current[parameter] = {};
      }
      current = current[parameter] as GoalTree;
    }
    // Add the goal object to the path
    // Includes a zero width non-joiner to decrease risk of colliding with user input
    // Otherwise, a param subsection could theoretically collide with a goal name/parameter and prevent the rendering of either the goal link or the param subsection <details> element
    // Example: Nameless goal with parameter "test" and unit "kg" would collide with a goal with parameter "test (kg)\\whatever"
    current[`${goal.name || goal.indicatorParameter.split('\\').slice(-1)} (\u200c${goal.dataSeries?.unit || "Enhet saknas"})`] = goal;
  }

  return tree;
}