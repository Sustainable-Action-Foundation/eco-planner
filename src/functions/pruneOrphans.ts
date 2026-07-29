import "server-only";
import { prisma } from "@/lib/prisma";

// TODO prune orphaned recipes just in case
/** Deletes all comments without parents. Fails silently. */
export default async function pruneOrphans() {
  try {
    await prisma.comments.deleteMany({
      where: {
        AND: [
          { action_id: null },
          { goal_id: null },
          { roadmap_id: null },
          { roadmap_iteration_id: null },
        ],
      },
    });
    return true;
  }
  catch {
    return false;
  }
}