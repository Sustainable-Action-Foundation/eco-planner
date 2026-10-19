'use server';

import { clientSafeDataSeriesSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { boundedFill, uncachedFallback } from "@/fetchers/cacheFallback";
import { visibleDataSeriesWHERE } from "@/lib/accessFilters";
import { prisma } from "@/lib/prisma";
import type { DataSeries, UserAccessContext } from "@/types";
import { cacheTag } from "next/cache";

/**
 * Gets specified data series, if the user can see it. Series visibility is derived
 * from the goal/effect context the series sits in.
 *
 * Returns null if the series is not found or user does not have access to it. Also returns null on error.
 */
export async function clientSafeGetOneDataSeries(id: string): Promise<DataSeries | null> {
  const accessContext = await getUserAccessContext();
  return uncachedFallback(() => clientSafeGetCachedDataSeries(id, accessContext), null, "Error fetching data series", { id });
}

async function clientSafeGetCachedDataSeries(id: string, accessContext: UserAccessContext | null): Promise<DataSeries | null> {
  'use cache';
  cacheTag('database', 'dataSeries', 'action', 'goal', 'roadmap', 'roadmapIteration');

  return boundedFill("clientSafeGetCachedDataSeries", async () => {
    const dataSeries: DataSeries | null = await prisma.dataSeries.findUnique({
      where: {
        id,
        // AND keeps the filter's optional unique-key fields out of the WhereUniqueInput type
        AND: [visibleDataSeriesWHERE(accessContext)],
      },
      select: clientSafeDataSeriesSelection,
    }) satisfies DataSeries | null;

    return dataSeries;
  });
}
