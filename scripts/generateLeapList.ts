import { IterationStatus, RoadmapType, Sharing } from "@/lib/prisma/generated";
import { prisma } from "@/lib/prisma";
import fs from "node:fs";

/**
 * This script generates a json file containing all indicator parameters from public, national roadmaps.
 * The file is used to generate suggestions for indicator parameters when creating a new goal.
 * The output is saved in src/lib/LEAPList.json
 */
async function generateLeapList() {
  let rawData;

  // Get the indicator parameters
  try {
    rawData = await prisma.roadmapIterations.findMany({
      where: {
        roadmap: {
          type: RoadmapType.NATIONAL,
          access_control: { sharing: Sharing.PUBLIC },
        },
        // Drafts are not public content
        status: { not: IterationStatus.DRAFT },
      },
      select: {
        goals: {
          select: {
            indicator_parameter: true,
          },
        },
      },
    });
  }
  catch (err) {
    console.error('Failed to fetch roadmaps for LEAP list generation.', { err });
    return;
  }

  if (rawData.length === 0) {
    console.info("No public, national roadmaps found; LEAP list not touched.");
    return;
  }

  // Flatten the data
  const leapList: string[] = [];
  for (const iteration of rawData) {
    for (const goal of iteration.goals) {
      if (typeof goal.indicator_parameter === 'string' && goal.indicator_parameter.length > 0) {
        leapList.push(goal.indicator_parameter);
      }
    }
  }

  // Remove duplicates and sort
  const uniqueLeapList = [...new Set(leapList)];
  uniqueLeapList.sort();

  // Write to file
  try {
    fs.writeFileSync('src/lib/LEAPList.json', JSON.stringify(uniqueLeapList));
    console.info('LEAP list updated');
  }
  catch (err) {
    console.warn('Failed to write LEAP list file', { err });
  }
}

generateLeapList()
  .finally(() => prisma.$disconnect())
  .catch((err: unknown) => {
    console.warn("Error generating LEAP list:", err);
    process.exitCode = 0; // Set exit code to 0 to prevent CI failure, as this is a non-critical operation
  });