import { AttachmentRejection, formatFileSize, MaxAttachmentBytes, MaxAttachmentsPerObject, rejectAttachment } from "@/functions/attachments";
import type { ToastType } from "@/components/generic/toast/types";
import { isStandardObject } from "@/types/typeguards";
import type { TFunction } from "i18next";

/*
 * The client side of attaching files: the same guards as the API, run before any
 * bytes leave the browser, and the sequential upload to `/api/attachment`. Shared by
 * the attachments section on object pages and by forms that attach while creating.
 */

type Notify = {
  t: TFunction;
  language: string;
  addToast: (message: string, type: ToastType, hasTimeout?: boolean) => void;
};

/** The files a file input holds; an untouched input yields one empty, nameless file, which is skipped. */
export function chosenFiles(values: FormDataEntryValue[] | FileList | null | undefined): File[] {
  return Array.from(values ?? []).filter((value): value is File => value instanceof File && (value.size > 0 || value.name !== ""));
}

/**
 * Tells the user about every file the API would refuse. Returns the files that pass,
 * or null when nothing should be sent at all (too many files), so a form can hold off.
 */
export function acceptableFiles(files: File[], alreadyAttached: number, { t, language, addToast }: Notify): File[] | null {
  if (files.length + alreadyAttached > MaxAttachmentsPerObject) {
    addToast(t("components:attachments.full", { max: MaxAttachmentsPerObject }), "error", false);
    return null;
  }
  return files.filter(file => {
    const rejection = rejectAttachment(file);
    if (rejection === null) return true;
    if (rejection === AttachmentRejection.TooLarge) {
      addToast(t("components:attachments.too_large", { name: file.name, maxSize: formatFileSize(MaxAttachmentBytes, language) }), "error", false);
    } else {
      addToast(t("components:attachments.type_not_allowed", { name: file.name }), "error", false);
    }
    return false;
  });
}

/**
 * Uploads the files one at a time to the object, toasting each outcome, and tells the
 * caller which file is in flight. Never throws; a failed file is reported and skipped.
 */
export async function uploadAttachments(
  files: File[],
  objectId: string,
  { t, addToast }: Notify,
  onProgress?: (fileName: string) => void,
): Promise<{ uploaded: number }> {
  let uploaded = 0;
  for (const file of files) {
    onProgress?.(file.name);
    const body = new FormData();
    body.set("objectId", objectId);
    body.set("file", file, file.name);
    try {
      const response = await fetch("/api/attachment", { method: "POST", body });
      const data: unknown = await response.json().catch(() => null);
      const message = isStandardObject(data) && "message" in data && typeof data.message === "string" ? data.message : `${response.status}`;
      if (!response.ok) throw new Error(message);
      addToast(message, "success");
      uploaded++;
    } catch (error) {
      addToast(t("components:attachments.upload_failed", { name: file.name, details: error instanceof Error ? error.message : String(error) }), "error", false);
    }
  }
  return { uploaded };
}
