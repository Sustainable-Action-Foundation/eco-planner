import "server-only";
import { prisma } from "@/lib/prisma";
import { deleteStoredObjects } from "@/lib/objectStorage";

const parentlessComment = {
  AND: [
    { action_id: null },
    { goal_id: null },
    { roadmap_id: null },
    { roadmap_iteration_id: null },
  ],
};

// Attachments can't hang off the roadmap itself
const parentlessAttachment = {
  AND: [
    { action_id: null },
    { goal_id: null },
    { roadmap_iteration_id: null },
  ],
};

// TODO prune orphaned recipes just in case
/** Deletes all comments and attachments without parents (attachments' files too). Fails silently. */
export default async function pruneOrphans() {
  try {
    await prisma.comments.deleteMany({ where: parentlessComment });
    const orphanedAttachments = await prisma.attachments.findMany({ where: parentlessAttachment, select: { storage_key: true } });
    if (orphanedAttachments.length > 0) {
      await prisma.attachments.deleteMany({ where: parentlessAttachment });
      await deleteStoredObjects(orphanedAttachments.map(attachment => attachment.storage_key));
    }
    return true;
  }
  catch {
    return false;
  }
}