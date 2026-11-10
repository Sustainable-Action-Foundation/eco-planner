import { attachmentExtension } from "@/functions/attachments";

/*
 * Pure helpers for an org's landing banner: the guards the upload API and the
 * management form share, and where the one stored image lives and is served from.
 * No `server-only`: unit tested, and the form uses the guards before uploading.
 */

/** Largest upload accepted, in bytes (10 MB, decimal like the size shown to users); well under `experimental.proxyClientMaxBodySize`. */
export const MaxOrgBannerBytes = 10 * 1000 * 1000;

/** Longest side of the stored image, in pixels: a full-width hero on a large screen; smaller images are kept as they are. */
export const OrgBannerMaxSide = 1920;

/** WebP quality of the stored image. */
export const OrgBannerQuality = 80;

/**
 * Image types managers may upload, by extension. Whatever the extension, the upload is
 * decoded and re-encoded as WebP, so the stored file never carries the original bytes
 * (SVG included: it is rasterised).
 */
export const AllowedOrgBannerTypes: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** The `accept` attribute for a file input limited to the allowed types. */
export const allowedOrgBannerAccept = Object.keys(AllowedOrgBannerTypes).map(ext => `.${ext}`).join(",");

/** Why an upload is refused, if it is. */
export const OrgBannerRejection = {
  Empty: "EMPTY",
  TooLarge: "TOO_LARGE",
  TypeNotAllowed: "TYPE_NOT_ALLOWED",
} as const;
export type OrgBannerRejection = (typeof OrgBannerRejection)[keyof typeof OrgBannerRejection];

/** Checks a file against the size and type guards; null means it may be uploaded. */
export function rejectOrgBanner(file: { name: string, size: number }): OrgBannerRejection | null {
  if (file.size <= 0) return OrgBannerRejection.Empty;
  if (file.size > MaxOrgBannerBytes) return OrgBannerRejection.TooLarge;
  if (!(attachmentExtension(file.name) in AllowedOrgBannerTypes)) return OrgBannerRejection.TypeNotAllowed;
  return null;
}

/** The bucket key of an org's banner: one per org, overwritten on replace, so nothing is orphaned. */
export function orgBannerStorageKey(orgId: string): string {
  return `org-banners/${orgId}.webp`;
}

/**
 * Where the banner is served from. The `v` query carries the upload time so the URL
 * changes with the image: the route marks a current version immutable, and a page
 * cached with the old URL keeps showing the old image until it is revalidated.
 */
export function orgBannerPath(orgId: string, updatedAt: Date | string | number): string {
  return `/api/org/${encodeURIComponent(orgId)}/banner?v=${new Date(updatedAt).getTime()}`;
}
