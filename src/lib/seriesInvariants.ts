import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Returns which of the given data series are already attached to a dependent slot
 * (a goal's data series/baseline/historical or an effect's data series).
 *
 * A series belongs to at most one slot; the unique FKs prevent two rows referencing
 * the same series through the SAME column, but nothing in the database stops e.g.
 * one goal's data series from being connected as another goal's baseline — that
 * cross-slot sharing is the invariant this check enforces in code. Callers decide
 * the exception of a series being re-linked to the slot it already occupies.
 */
export async function findClaimedSeries(seriesIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(seriesIds)];
  if (uniqueIds.length === 0) {
    return [];
  }
  const claimed = await prisma.dataSeries.findMany({
    where: {
      id: { in: uniqueIds },
      OR: [
        { dependent_goal: { isNot: null } },
        { dependent_baseline: { isNot: null } },
        { dependent_historical: { isNot: null } },
        { dependent_effect: { isNot: null } },
      ],
    },
    select: { id: true },
  });
  return claimed.map(series => series.id);
}
