import { DataSeries, Goal } from "@prisma/client";

export type GoalTree = { [key: string]: GoalTree | (Goal & { dataSeries: DataSeries | null } & { roadmap: { id: string, metaRoadmap: { name: string, id: string } } }) }

export default function goalsToTree(goals: ((Goal & { dataSeries: DataSeries | null } & { roadmap: { id: string, metaRoadmap: { name: string, id: string } } }) | null)[]) {
  const tree: GoalTree = {}

  for (const goal of goals) {
    if (!goal) {
      continue
    }

    const parameters = goal.indicatorParameter.split('\\')

    // TODO: check if naming of demand and key makes sense
    if (parameters[0].toLowerCase() == 'key' || parameters[0].toLowerCase() == 'demand') {
      parameters.shift();
    }

    // Create the path to the goal
    let current = tree
    for (const parameter of parameters) {
      if (!current[parameter]) {
        current[parameter] = {}
      }
      // This should be fine as long as there are no 2 parameters such that param2 = param1 + '\\' + param1
      // And even then there should be no hard errors, the goal with param2 should just not show up in the frontend UI
      // TODO: Check if this is a valid assumption
      current = current[parameter] as GoalTree
    }
    // Add the goal object to the path
    current[`${goal.name || goal.indicatorParameter.split('\\').slice(-1)}${goal.dataSeries?.unit ? ` - ${goal.dataSeries.unit}` : ''}`] = goal
  }

  return tree
}