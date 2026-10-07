import { getUserAccessContext } from "@/fetchers/getUserAccessContext";
import { visibleAttachmentsWHERE } from "@/lib/accessFilters";
import serveTea from "@/lib/i18nServer";
import { isObjectStorageConfigured, presignedDownloadUrl } from "@/lib/objectStorage";
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * Downloads an attachment. The bucket is private, so after checking that the user may
 * see the object the file hangs off, this redirects to a short-lived presigned link that
 * serves the file under its original name. Anonymous visitors get public content, like
 * everywhere else.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ attachmentId: string }> }) {
  const [{ attachmentId }, accessContext, t] = await Promise.all([
    context.params,
    getUserAccessContext(),
    serveTea("api"),
  ]);

  let attachment: { storage_key: string, name: string, content_type: string } | null;
  try {
    attachment = await prisma.attachments.findFirst({
      where: { id: attachmentId, AND: [visibleAttachmentsWHERE(accessContext)] },
      select: { storage_key: true, name: true, content_type: true },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ message: t("api:common.server_error") },
      { status: 500 },
    );
  }

  if (!attachment) {
    return Response.json({ message: t("api:attachment.not_found") },
      { status: 404 },
    );
  }

  if (!isObjectStorageConfigured()) {
    return Response.json({ message: t("api:attachment.storage_unavailable") },
      { status: 503 },
    );
  }

  const url = await presignedDownloadUrl(attachment.storage_key, attachment.name, attachment.content_type);
  // The link expires, so neither the redirect nor the target may be cached
  return Response.redirect(url, 302);
}
