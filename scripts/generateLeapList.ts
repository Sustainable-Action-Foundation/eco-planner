import { prisma } from "@/lib/prisma";
import { RoadmapType } from "../prisma/generated/enums";
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
    rawData = await prisma.roadmap.findMany({
      where: {
        metaRoadmap: { type: RoadmapType.NATIONAL },
        isPublic: true,
      },
      select: {
        goals: {
          select: {
            indicatorParameter: true,
          },
        },
      },
    });
  }
  catch {
    console.log('Failed to fetch roadmaps for LEAP list generation.');
    return;
  }

  if (rawData.length === 0) {
    console.log("No public, national roadmaps found; LEAP list not touched.");
    return;
  }

  // Flatten the data
  const leapList: string[] = [];
  for (const roadmap of rawData) {
    for (const goal of roadmap.goals) {
      if (typeof goal.indicatorParameter === 'string' && goal.indicatorParameter.length > 0) {
        leapList.push(goal.indicatorParameter);
      }
    }
  }

  // Remove duplicates and sort
  const uniqueLeapList = [...new Set(leapList)];
  uniqueLeapList.sort();

  // Write to file
  try {
    fs.writeFileSync('src/lib/LEAPList.json', JSON.stringify(uniqueLeapList));
    console.log('LEAP list updated');
  } catch {
    console.log('Failed to update LEAP list');
  }
}

generateLeapList()
  .finally(() => prisma.$disconnect())
  .catch((err: unknown) => {
    console.error("Error generating LEAP list:", err);
    process.exit(1);
  });