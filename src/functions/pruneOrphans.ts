import "server-only";
import prisma from "@/prismaClient";

// TODO prune orphaned recipes just in case
/** Deletes all links and comments without parents. Fails silently. Returns true on success, false on failure. */
export default async function pruneOrphans() {
  try {
    await prisma.$transaction([
      prisma.link.deleteMany({
        where: {
          AND: [
            { actionId: null },
            { goalId: null },
            { metaRoadmapId: null },
          ]
        }
      }),
      prisma.comment.deleteMany({
        where: {
          AND: [
            { actionId: null },
            { goalId: null },
            { roadmapId: null },
            { metaRoadmapId: null },
          ]
        }
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}