import { GoalListing } from "@/lib/prisma/generated";
import type { Goal, RoadmapIteration } from "@/types";

export default function findSiblings(
  iteration: RoadmapIteration,
  goal: Goal,
): RoadmapIteration["goals"] {
  const siblings: RoadmapIteration["goals"] = [];

  const goalParameters = goal.indicator_parameter.split("\\");
  // Remove the "Key" or "Demand" parameter if present
  if (goalParameters[0] === "Key" || goalParameters[0] === "Demand") {
    goalParameters.shift();
  }

  for (const sibling of iteration.goals) {
    // We do not include the goal itself among it's sibings
    if (sibling.id === goal.id) {
      continue;
    }

    // Unlisted goals are excluded from other goals' sibling listings
    if (sibling.listing === GoalListing.UNLISTED) {
      continue;
    }

    const siblingParameters = sibling.indicator_parameter.split("\\");
    // Goals can be siblings despite one of them having a "Key" and the other a "Demand" parameter
    if (siblingParameters[0] === "Key" || siblingParameters[0] === "Demand") {
      siblingParameters.shift();
    }

    let isSibling = true;
    // Goals with different data units are not siblings
    // TODO: Use mathjs for comparison
    if (goal.data_series?.unit !== sibling.data_series?.unit) {
      isSibling = false;
    }
    // Goals on different levels are not siblings
    if (isSibling) {
      if (goalParameters.length !== siblingParameters.length) {
        isSibling = false;
      }
    }
    // Goals with different parameters (except the last one) are not siblings
    if (isSibling) {
      for (let i = 0; i < goalParameters.length - 1; i++) {
        if (goalParameters[i] !== siblingParameters[i]) {
          isSibling = false;
          break;
        }
      }
    }
    if (isSibling) {
      siblings.push(sibling);
    }
  }

  return siblings;
}
