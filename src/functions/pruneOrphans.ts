import "server-only";
import { prisma } from "@/lib/prisma";

// TODO prune orphaned recipes just in case
/** Deletes all comments without parents. Fails silently. */
export default async function pruneOrphans() {
  try {
    await prisma.comment.deleteMany({
      where: {
        AND: [
          { actionId: null },
          { goalId: null },
          { roadmapId: null },
          { metaRoadmapId: null },
        ],
      },
    });
    return true;
  }
  catch {
    return false;
  }
}