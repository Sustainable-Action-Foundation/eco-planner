'use client';

import { useToast } from "@/components/generic/toast/toastContext.use";
import { allowedAttachmentAccept, attachmentDownloadPath, AttachmentRejection, formatFileSize, MaxAttachmentBytes, MaxAttachmentsPerObject, rejectAttachment } from "@/functions/attachments";
import type { Attachments as AttachmentModel } from "@/lib/prisma/generated";
import { isStandardObject } from "@/types/typeguards";
import { IconFileDescription, IconFileTypePdf, IconFileTypeXls, IconFileTypeZip, IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./attachments.module.css";

export type AttachmentEntry = Pick<AttachmentModel, "id" | "name" | "size" | "content_type" | "created_at"> & {
  author: { id: string, username: string } | null;
};

/**
 * The documents attached to a roadmap, version, goal or action: a list with download
 * links, and for editors an upload form and a remove button per file. The server's
 * list is the truth; after a change the route is refreshed so it catches up.
 */
export default function Attachments({ attachments, objectId, canEdit }: { attachments: AttachmentEntry[], objectId: string, canEdit: boolean }) {
  const { t, i18n } = useTranslation(["components", "common"]);
  const { addToast } = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);

  const sorted = [...attachments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const full = attachments.length >= MaxAttachmentsPerObject;

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const files = Array.from(fileInput.current?.files ?? []);
    if (files.length === 0 || pending) return;

    for (const file of files) {
      // The same guards as the API, so a refusal shows before the upload starts
      const rejection = rejectAttachment(file);
      if (rejection === AttachmentRejection.TooLarge) {
        addToast(t("components:attachments.too_large", { name: file.name, maxSize: formatFileSize(MaxAttachmentBytes, i18n.language) }), "error", false);
        continue;
      }
      if (rejection !== null) {
        addToast(t("components:attachments.type_not_allowed", { name: file.name }), "error", false);
        continue;
      }

      setPending(file.name);
      const body = new FormData();
      body.set("objectId", objectId);
      body.set("file", file, file.name);
      try {
        const response = await fetch("/api/attachment", { method: "POST", body });
        const data: unknown = await response.json().catch(() => null);
        const message = isStandardObject(data) && "message" in data && typeof data.message === "string" ? data.message : `${response.status}`;
        if (!response.ok) throw new Error(message);
        addToast(message, "success");
      } catch (error) {
        addToast(t("components:attachments.upload_failed", { name: file.name, details: error instanceof Error ? error.message : String(error) }), "error", false);
      }
    }

    setPending(null);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  async function remove(attachment: AttachmentEntry) {
    if (pending || !window.confirm(t("components:attachments.confirm_delete", { name: attachment.name }))) return;
    setPending(attachment.name);
    try {
      const response = await fetch("/api/attachment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: attachment.id }),
      });
      const data: unknown = await response.json().catch(() => null);
      const message = isStandardObject(data) && "message" in data && typeof data.message === "string" ? data.message : `${response.status}`;
      if (!response.ok) throw new Error(message);
      addToast(message, "success");
      router.refresh();
    } catch (error) {
      addToast(t("components:attachments.delete_failed", { name: attachment.name, details: error instanceof Error ? error.message : String(error) }), "error", false);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="container-text" data-testid="attachments">
      <h2>{t("components:attachments.count", { count: attachments.length })}</h2>

      {canEdit ?
        <form onSubmit={event => void upload(event)} className={`${styles.uploadForm} margin-bottom-100`}>
          <label className="flex-grow-100">
            <span className="block font-weight-500 margin-bottom-25">{t("components:attachments.choose_files")}</span>
            <input
              ref={fileInput}
              type="file"
              name="file"
              multiple={true}
              accept={allowedAttachmentAccept}
              disabled={!!pending || full}
              data-testid="attachment-input"
            />
            <small className="block margin-top-25" style={{ color: 'gray' }}>
              {full
                ? t("components:attachments.full", { max: MaxAttachmentsPerObject })
                : t("components:attachments.allowed_hint", { maxSize: formatFileSize(MaxAttachmentBytes, i18n.language) })}
            </small>
          </label>
          <button type="submit" className={`${styles.uploadButton} flex align-items-center gap-25`} disabled={!!pending || full} data-testid="attachment-upload">
            <IconUpload aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
            {pending ? t("components:attachments.uploading", { name: pending }) : t("components:attachments.upload")}
          </button>
        </form>
        : null}

      {sorted.length === 0 ?
        <p className="margin-0" style={{ color: 'gray' }}>{t("components:attachments.empty")}</p>
        :
        <ul className={styles.list}>
          {sorted.map(attachment => (
            <li key={attachment.id} className={styles.row} data-testid="attachment-row">
              <FileIcon contentType={attachment.content_type} />
              <div className={styles.details}>
                <Link href={attachmentDownloadPath(attachment.id)} className={styles.name} prefetch={false}>
                  {attachment.name}
                </Link>
                <span className={styles.meta}>
                  <span>{formatFileSize(attachment.size, i18n.language)}</span>
                  {attachment.author ?
                    <Link className="discrete-link" href={`/@${attachment.author.username}`}>{attachment.author.username}</Link>
                    : <span>{t("components:attachments.deleted_user")}</span>}
                  <span title={new Date(attachment.created_at).toLocaleString()}>
                    {t("components:attachments.relative_time", { date: new Date(attachment.created_at) })}
                  </span>
                </span>
              </div>
              {canEdit ?
                <button
                  type="button"
                  className={`${styles.removeButton} transparent grid padding-25 round`}
                  onClick={() => void remove(attachment)}
                  disabled={!!pending}
                  aria-label={t("components:attachments.delete", { name: attachment.name })}
                  title={t("components:attachments.delete", { name: attachment.name })}
                  data-testid="attachment-delete"
                >
                  <IconTrash aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
                </button>
                : null}
            </li>
          ))}
        </ul>
      }
    </div>
  );
}

/** A glyph for the file's family; purely decorative, the name carries the extension. */
function FileIcon({ contentType }: { contentType: string }) {
  const props = { "aria-hidden": true, width: 28, height: 28, strokeWidth: 1.5, style: { minWidth: '28px', color: 'var(--gray-40)' } } as const;
  if (contentType === "application/pdf") return <IconFileTypePdf {...props} />;
  if (contentType.startsWith("image/")) return <IconPhoto {...props} />;
  if (contentType === "application/zip") return <IconFileTypeZip {...props} />;
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType === "text/csv") return <IconFileTypeXls {...props} />;
  return <IconFileDescription {...props} />;
}
