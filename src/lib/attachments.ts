import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/prisma/generated";
import { deleteStoredObjects } from "@/lib/objectStorage";
import type findTypeFromId from "@/functions/findTypeFromId";

/*
 * Server-side glue between attachment rows and the stored files. Deleting a roadmap,
 * version, goal or action cascades its attachment rows away in the database, but the
 * files in the bucket don't follow, so the DELETE routes collect the keys first and
 * remove the files once the rows are gone.
 */

/** The parents an attachment can hang off, named as `findTypeFromId` names them (they double as cache tags). */
export type AttachmentParent = NonNullable<Awaited<ReturnType<typeof findTypeFromId>>>;

/** Matches every attachment under the given object, including those on its descendants. */
export function attachmentsUnderWHERE(parent: AttachmentParent, id: string): Prisma.AttachmentsWhereInput {
  switch (parent) {
    case "action":
      return { action_id: id };
    case "goal":
      return { goal_id: id };
    case "roadmapIteration":
      return {
        OR: [
          { roadmap_iteration_id: id },
          { goal: { roadmap_iteration_id: id } },
          { action: { roadmap_iteration_id: id } },
        ],
      };
    case "roadmap":
      return {
        OR: [
          { roadmap_id: id },
          { roadmap_iteration: { roadmap_id: id } },
          { goal: { roadmap_iteration: { roadmap_id: id } } },
          { action: { roadmap_iteration: { roadmap_id: id } } },
        ],
      };
    default:
      // The union is covered above; `in: []` matches nothing
      return { id: { in: [] } };
  }
}

/** The storage keys of every attachment under the object, to remove after the object is deleted. */
export async function storedKeysUnder(parent: AttachmentParent, id: string): Promise<string[]> {
  try {
    const rows = await prisma.attachments.findMany({ where: attachmentsUnderWHERE(parent, id), select: { storage_key: true } });
    return rows.map(row => row.storage_key);
  } catch (error) {
    console.error("Failed to list attachments for cleanup", { parent, id, error });
    return [];
  }
}

/** Removes the files behind keys collected with `storedKeysUnder`. Best effort, never throws. */
export async function removeStoredFiles(keys: string[]): Promise<void> {
  await deleteStoredObjects(keys);
}
