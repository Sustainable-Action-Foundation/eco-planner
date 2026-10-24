/*
 * Pure helpers for document attachments on roadmaps, versions, goals and actions.
 * The guards against abuse live here (size, count, file type) so both the API
 * and the upload form agree on them, and so they can be unit tested without a bucket.
 */

/** Largest file accepted, in bytes (25 MB, decimal like the size shown to users). Keep `experimental.proxyClientMaxBodySize` in next.config.ts above this. */
export const MaxAttachmentBytes = 25 * 1000 * 1000;

/** How many files one roadmap, version, goal or action may carry. */
export const MaxAttachmentsPerObject = 25;

/** Longest stored file name; longer names are cut, keeping the extension. */
export const MaxAttachmentNameLength = 160;

/**
 * File types users may attach, by extension. The MIME type is taken from here rather than
 * from the upload, since browsers guess it and it ends up as the download's Content-Type.
 * Deliberately no HTML/SVG/scripts: they could carry markup, and nothing here needs them.
 */
export const AllowedAttachmentTypes: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
};

/** The `accept` attribute for a file input limited to the allowed types. */
export const allowedAttachmentAccept = Object.keys(AllowedAttachmentTypes).map(ext => `.${ext}`).join(",");

/** The lowercased extension of a file name, without the dot; empty when there is none. */
export function attachmentExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/** The MIME type an attachment is stored and served with, or null when the type isn't allowed. */
export function attachmentContentType(name: string): string | null {
  return AllowedAttachmentTypes[attachmentExtension(name)] ?? null;
}

/**
 * A file name safe to store and to echo back in headers: no path separators or control
 * characters, no leading dots, trimmed, and cut to `MaxAttachmentNameLength` with the
 * extension kept. Falls back to "file" when nothing is left.
 */
export function sanitizeAttachmentName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex -- control characters are exactly what's being removed
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "file";
  if (cleaned.length <= MaxAttachmentNameLength) return cleaned;

  const extension = attachmentExtension(cleaned);
  const stem = extension ? cleaned.slice(0, -(extension.length + 1)) : cleaned;
  const keep = Math.max(1, MaxAttachmentNameLength - (extension ? extension.length + 1 : 0));
  return extension ? `${stem.slice(0, keep).trimEnd()}.${extension}` : stem.slice(0, keep).trimEnd();
}

/** Why an upload is refused, if it is. */
export const AttachmentRejection = {
  Empty: "EMPTY",
  TooLarge: "TOO_LARGE",
  TypeNotAllowed: "TYPE_NOT_ALLOWED",
} as const;
export type AttachmentRejection = (typeof AttachmentRejection)[keyof typeof AttachmentRejection];

/** Checks a file against the size and type guards; null means it may be uploaded. */
export function rejectAttachment(file: { name: string, size: number }): AttachmentRejection | null {
  if (file.size <= 0) return AttachmentRejection.Empty;
  if (file.size > MaxAttachmentBytes) return AttachmentRejection.TooLarge;
  if (!attachmentContentType(file.name)) return AttachmentRejection.TypeNotAllowed;
  return null;
}

/** Where a stored attachment is downloaded from. */
export function attachmentDownloadPath(attachmentId: string): string {
  return `/api/attachment/${encodeURIComponent(attachmentId)}`;
}

/** A file size for people: "1.2 MB", "340 kB", "12 B". */
export function formatFileSize(bytes: number, locale?: string): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: units[unit], maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 }).format(value);
}
