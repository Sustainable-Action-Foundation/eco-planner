"use client";

import { allowedAttachmentAccept, formatFileSize, MaxAttachmentBytes, MaxAttachmentsPerObject } from "@/functions/attachments";
import { IconPaperclip } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import styles from "@/components/form/forms.module.css";

/**
 * The documents section of a create form: a plain multiple file input, read from the
 * form data on submit and uploaded once the object exists (see `thenAttach`). Existing
 * objects attach from their page instead, where the list of attachments lives.
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
  testId?: string,
}) {
  const { t, i18n } = useTranslation(["forms"]);

  return (
    <fieldset className={`${styles.timeLineFieldset} width-100 margin-top-200`}>
      <legend data-position={position} className={`${styles.timeLineLegend} padding-block-125 font-weight-bold`}>
        {t("forms:attachments.legend")}
      </legend>
      <label className="block">
        <span className="flex align-items-center gap-25 margin-bottom-25">
          <IconPaperclip aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          {t("forms:attachments.label")}
        </span>
        <input
          type="file"
          name={name}
          multiple={true}
          accept={allowedAttachmentAccept}
          data-testid={testId}
        />
      </label>
      <small className="block margin-top-25" style={{ color: 'gray' }}>
        {t("forms:attachments.limits", { maxSize: formatFileSize(MaxAttachmentBytes, i18n.language), max: MaxAttachmentsPerObject })}
        {" "}
        {description}
      </small>
    </fieldset>
  );
}
