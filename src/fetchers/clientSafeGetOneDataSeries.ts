'use server';

import { clientSafeDataSeriesSelection } from "@/fetchers/inclusionSelectors";
import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleDataSeriesWhere } from "@/lib/accessFilters";
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
  return clientSafeGetCachedDataSeries(id, accessContext);
}

async function clientSafeGetCachedDataSeries(id: string, accessContext: UserAccessContext | null): Promise<DataSeries | null> {
  'use cache';
  cacheTag('database', 'dataSeries', 'action', 'goal');

  let dataSeries: DataSeries | null;
  try {
    dataSeries = await prisma.dataSeries.findUnique({
      where: {
        id,
        // AND keeps the filter's optional unique-key fields out of the WhereUniqueInput type
        AND: [visibleDataSeriesWhere(accessContext)],
      },
      select: clientSafeDataSeriesSelection,
    }) satisfies DataSeries | null;
  }
  catch (err) {
    console.error("Error fetching data series", { error: err });
    return null;
  }

  return dataSeries;
}
