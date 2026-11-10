'use client';

import { useToast } from "@/components/generic/toast/toastContext.use";
import { formatFileSize } from "@/functions/attachments";
import { allowedOrgBannerAccept, MaxOrgBannerBytes, OrgBannerMaxSide, OrgBannerRejection, rejectOrgBanner } from "@/functions/orgBanner";
import type { OrgManagement } from "@/fetchers/getOrgManagement";
import { isStandardObject } from "@/types/typeguards";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "@/components/attachments/attachments.module.css";

/** The hero's proportions, so the preview shows what the landing page will crop to */
const previewAspect = "1250 / 350";

/**
 * The org's landing banner on the management page: the current image (or a note that
 * there is none), a button and drop zone that upload straight away, and a remove
 * button. The server's state is the truth; after a change the route is refreshed.
 */
export default function OrgBanner({ org }: { org: OrgManagement["org"] }) {
  const { t, i18n } = useTranslation(["pages", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);

  /** The API's message, or the status when the body isn't the usual `{ message }` */
  async function messageOf(response: Response): Promise<string> {
    const data: unknown = await response.json().catch(() => null);
    return isStandardObject(data) && "message" in data && typeof data.message === "string" ? data.message : `${response.status}`;
  }

  /** Sends the chosen or dropped file straight away; there is no separate "save" step */
  async function upload(file: File | undefined) {
    if (!file || pending) return;

    // The same guards as the API, so a refusal shows before the upload starts
    const rejection = rejectOrgBanner(file);
    if (rejection === OrgBannerRejection.TooLarge) {
      addToast(t("pages:org_groups.banner_too_large", { name: file.name, maxSize: formatFileSize(MaxOrgBannerBytes, i18n.language) }), "error", false);
      return;
    }
    if (rejection !== null) {
      addToast(t("pages:org_groups.banner_type_not_allowed", { name: file.name }), "error", false);
      return;
    }

    setPending(true);
    const body = new FormData();
    body.set("file", file, file.name);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(org.id)}/banner`, { method: "POST", body });
      const message = await messageOf(response);
      if (!response.ok) throw new Error(message);
      addToast(message, "success");
      router.refresh();
    } catch (error) {
      addToast(t("pages:org_groups.banner_upload_failed", { details: error instanceof Error ? error.message : String(error) }), "error", false);
    } finally {
      setPending(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove() {
    if (pending || !window.confirm(t("pages:org_groups.banner_confirm_remove"))) return;
    setPending(true);
    try {
      const response = await fetch(`/api/org/${encodeURIComponent(org.id)}/banner`, { method: "DELETE" });
      const message = await messageOf(response);
      if (!response.ok) throw new Error(message);
      addToast(message, "success");
      router.refresh();
    } catch (error) {
      addToast(t("pages:org_groups.banner_remove_failed", { details: error instanceof Error ? error.message : String(error) }), "error", false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="margin-top-100" data-testid="org-banner-form">
      <p className="font-weight-500 margin-0">{t("pages:org_groups.banner_label")}</p>
      <p className="margin-block-25 color-gray font-size-14px">{t("pages:org_groups.banner_description", { maxSide: OrgBannerMaxSide })}</p>

      {/* The preview has the hero's shape and colour, so a transparent or narrow image shows as it will land */}
      <div className="rounded position-relative overflow-hidden margin-bottom-50" style={{ aspectRatio: previewAspect, maxWidth: '40rem', backgroundColor: 'var(--seagreen)' }}>
        {org.bannerUrl ?
          <Image src={org.bannerUrl} alt={t("pages:org_groups.banner_preview_alt", { org: org.name })} fill={true} unoptimized={true} style={{ objectFit: 'cover' }} data-testid="org-banner-preview" />
          : <p className="margin-0 padding-100 color-purewhite font-weight-500" data-testid="org-banner-none">{t("pages:org_groups.banner_none")}</p>}
      </div>

      <div
        className={styles.dropZone}
        style={{ maxWidth: '40rem' }}
        data-dragging={dragging}
        data-testid="org-banner-dropzone"
        onDragOver={event => { event.preventDefault(); if (!pending) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files[0]); }}
      >
        {/* The input stays hidden: the button opens it, the box takes drops, and either choice uploads at once */}
        <input
          ref={fileInput}
          type="file"
          name="banner"
          accept={allowedOrgBannerAccept}
          className="display-none"
          data-testid="org-banner-input"
          onChange={event => {
            void upload(event.target.files?.[0]);
            // The same file chosen twice in a row should still fire a change
            event.target.value = "";
          }}
        />
        <div className="flex gap-50 flex-wrap-wrap justify-content-center">
          <button
            type="button"
            className={`${styles.uploadButton} flex align-items-center gap-25`}
            disabled={pending}
            data-testid="org-banner-upload"
            onClick={() => fileInput.current?.click()}
          >
            <IconUpload aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
            {pending ? t("pages:org_groups.banner_uploading") : org.bannerUrl ? t("pages:org_groups.banner_replace") : t("pages:org_groups.banner_choose")}
          </button>
          {org.bannerUrl ?
            <button
              type="button"
              className="flex align-items-center gap-25 transparent round padding-inline-100"
              disabled={pending}
              onClick={() => void remove()}
              data-testid="org-banner-remove"
            >
              <IconTrash aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
              {t("pages:org_groups.banner_remove")}
            </button>
            : null}
        </div>
        <small className={styles.dropHint}>{t("pages:org_groups.banner_hint", { maxSize: formatFileSize(MaxOrgBannerBytes, i18n.language) })}</small>
      </div>
    </div>
  );
}
