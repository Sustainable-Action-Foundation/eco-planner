"use client";

import { clientSafeGetOneRoadmap, clientSafeGetRoadmaps } from "@/fetchers/client";
import type { ClientMultiRoadmapInstance, ClientRoadmap } from "@/types";

export type RecipeRoadmapData = {
  roadmaps: ClientMultiRoadmapInstance[];
  roadmapLookup: Record<string, ClientRoadmap>;
};

let cachedRoadmapDataPromise: Promise<RecipeRoadmapData> | null = null;

function hasPullableData(roadmap: ClientRoadmap): boolean {
  return roadmap.goals.some((goal) => {
    if (goal.dataSeries || goal.baseline) return true;
    return goal.effects.some((effect) => !!effect.dataSeries);
  });
}

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
    })().catch((error: unknown) => {
      cachedRoadmapDataPromise = null;
      throw error;
    });

  return cachedRoadmapDataPromise;
}
