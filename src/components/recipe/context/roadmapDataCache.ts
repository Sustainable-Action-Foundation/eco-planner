"use client";

/* 
 * This file is a solution to a lot of components in the recipe editor wanting to know about roadmaps and their data series and they all fetched independently until now, hopefully :pray:
 */

import { clientSafeGetOneRoadmap, clientSafeGetRoadmaps } from "@/fetchers/client";
import type { ClientMultiRoadmapInstance, ClientRoadmap } from "@/types";

export type RecipeRoadmapData = {
  roadmaps: ClientMultiRoadmapInstance[];
  roadmapLookup: Record<string, ClientRoadmap>;
};

let cachedRoadmapDataPromise: Promise<RecipeRoadmapData> | null = null;

/**
 * Pullable in the sense that in the data series tree input can be populated with data from the provided roadmap.
 */
function hasPullableData(roadmap: ClientRoadmap): boolean {
  return roadmap.goals.some((goal) => {
    if (goal.dataSeries || goal.baseline) return true;
    return goal.effects.some((effect) => !!effect.dataSeries);
  });
}

// TODO: this still double fetches a lot of data but it's still an improvement over the previous implementation where it fetched this data in multiple places.
export async function getRecipeRoadmapData(): Promise<RecipeRoadmapData> {
  cachedRoadmapDataPromise ??= (async () => {
    const roadmaps = await clientSafeGetRoadmaps();

    const roadmapsWithData = await Promise.all(
      roadmaps.map(async (roadmap) => {
        const fullRoadmap = await clientSafeGetOneRoadmap(roadmap.id);
        if (!fullRoadmap || !hasPullableData(fullRoadmap)) return null;
        return { roadmap, fullRoadmap };
      }),
    );

    const resolvedRoadmaps = roadmapsWithData
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);

    return {
      roadmaps: resolvedRoadmaps.map(({ roadmap }) => roadmap),
      roadmapLookup: Object.fromEntries(
        resolvedRoadmaps.map(({ roadmap, fullRoadmap }) => [roadmap.id, fullRoadmap]),
      ),
    };
  })()
    .catch((err: unknown) => {
      cachedRoadmapDataPromise = null;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch roadmap data:", err);
      throw new Error(`Failed to fetch roadmap data: ${errorMessage}`);
    });

  return cachedRoadmapDataPromise;
}
