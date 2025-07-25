import "server-only";
import prisma from "@/prismaClient";

/** Deletes all links and comments without parents. Fails silently. */
export default async function pruneOrphans() {
  let success: boolean = false;
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
    success = true;
  } catch {
    success = false;
  } finally {
    return success;
  }
}