import { goalSorterTree } from "@/lib/sorters";
import type { GoalTree, GoalTreeEntry } from "@/types";
import type { TFunction } from "i18next";

export default function goalsToTree(goals: Array<GoalTreeEntry | null>, t: TFunction) {
  const filteredGoals = goals.filter(goal => goal != null);
  const sortedGoals = filteredGoals.sort(goalSorterTree);
  const tree: GoalTree = {};

  for (const goal of sortedGoals) {
    const parameters = goal.indicatorParameter.split('\\');

    // "key" and "demand" are currently the first subsection in the parameters of our data exported from LEAP, but they are mainly metadata and not relevant for the tree structure
    if (parameters[0].toLowerCase() === 'key' || parameters[0].toLowerCase() === 'demand') {
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
    const indicatorName = goal.name ?? goal.indicatorParameter.split('\\').at(-1);
    const unit = goal.dataSeries?.unit === null
      ? t("common:tsx.unitless")
      : goal.dataSeries?.unit ?? t("common:tsx.unit_missing");
    current[`${indicatorName} (\u200c${unit})`] = goal;
  }

  return tree;
}