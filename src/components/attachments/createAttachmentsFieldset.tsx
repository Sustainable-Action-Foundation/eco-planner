"use client";

import { allowedAttachmentAccept, formatFileSize, MaxAttachmentBytes, MaxAttachmentsPerObject } from "@/functions/attachments";
import { chosenFiles } from "./uploadAttachments";
import { IconPaperclip, IconUpload, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import formStyles from "@/components/form/forms.module.css";
import styles from "./attachments.module.css";

/**
 * The documents section of a create form: a multiple file input read from the form
 * data on submit and uploaded once the object exists (see `thenAttach`). The input
 * itself stays hidden behind a button and a drop zone, like on the object pages: the
 * site hides the native file button, and WebKit then draws nothing of the input at all.
 * Existing objects attach from their page instead, where the list of attachments lives.
 */
export default function CreateAttachmentsFieldset({
  name,
  position,
  description,
  testId,
}: {
  /** The form name of the file input */
  name: string,
  /** The legend's data-position in the form's timeline */
  position: number,
  /** What happens to the files, e.g. "uploaded once the goal exists" */
  description: string,
  /** Prefix of the test ids: `{testId}-input`, `{testId}-button`, `{testId}-row` */
  testId?: string,
}) {
  const { t, i18n } = useTranslation(["forms", "components"]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  /** Puts `files` in the hidden input (what the form submits) and mirrors them in the list */
  function choose(files: File[]) {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    if (fileInput.current) fileInput.current.files = transfer.files;
    setChosen(files);
  }

  return (
    <fieldset className={`${formStyles.timeLineFieldset} width-100 margin-top-200`}>
      <legend data-position={position} className={`${formStyles.timeLineLegend} padding-block-125 font-weight-bold`}>
        {t("forms:attachments.legend")}
      </legend>
      <span className="flex align-items-center gap-25 margin-bottom-25">
        <IconPaperclip aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
        {t("forms:attachments.label")}
      </span>
      <div
        className={styles.dropZone}
        data-dragging={dragging}
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); choose(chosenFiles(event.dataTransfer.files)); }}
      >
        <input
          ref={fileInput}
          type="file"
          name={name}
          multiple={true}
          accept={allowedAttachmentAccept}
          className="display-none"
          data-testid={testId ? `${testId}-input` : undefined}
          onChange={event => setChosen(chosenFiles(event.target.files))}
        />
        <button
          type="button"
          className={`${styles.uploadButton} flex align-items-center gap-25`}
          data-testid={testId ? `${testId}-button` : undefined}
          onClick={() => fileInput.current?.click()}
        >
          <IconUpload aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          {t("components:attachments.attach")}
        </button>
        <small className={styles.dropHint}>{t("components:attachments.drop_hint")}</small>
      </div>
      {chosen.length > 0 ?
        <ul className={`${styles.list} margin-block-50`}>
          {chosen.map((file, index) => (
            <li key={`${file.name}-${index}`} className={styles.row} data-testid={testId ? `${testId}-row` : undefined}>
              <div className={styles.details}>
                <span className={styles.name}>{file.name}</span>
                <span className={styles.meta}>{formatFileSize(file.size, i18n.language)}</span>
              </div>
              <button
                type="button"
                className={`${styles.removeButton} transparent grid padding-25 round`}
                onClick={() => choose(chosen.filter((_, i) => i !== index))}
                aria-label={t("components:attachments.delete", { name: file.name })}
                title={t("components:attachments.delete", { name: file.name })}
              >
                <IconX aria-hidden="true" width={20} height={20} style={{ minWidth: '20px' }} />
              </button>
            </li>
          ))}
        </ul>
        : null}
      <small className="block margin-top-25" style={{ color: 'gray' }}>
        {t("forms:attachments.limits", { maxSize: formatFileSize(MaxAttachmentBytes, i18n.language), max: MaxAttachmentsPerObject })}
        {" "}
        {description}
      </small>
    </fieldset>
  );
}
