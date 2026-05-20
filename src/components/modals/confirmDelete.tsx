'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useState } from "react";
import { closeModal } from "@/components/modals/modalFunctions";
import styles from './modals.module.css';
import { Trans, useTranslation } from "react-i18next";
import { IconX } from "@tabler/icons-react";

export default function ConfirmDelete({
  modalRef,
  targetUrl,
  targetName,
  targetId,
}: {
  modalRef: React.RefObject<HTMLDialogElement | null>;
  targetUrl: string;
  targetName: string;
  targetId?: string | { actionId: string, goalId: string };
}) {
  const { t } = useTranslation(["components", "common"]);

  const [isLoading, setIsLoading] = useState(false);
  let elementId: string;
  if (typeof targetId === "object") {
    elementId = `${targetId.actionId}-${targetId.goalId}`;
  } else if (typeof targetId === "string") {
    elementId = targetId;
  } else {
    elementId = "";
    console.error(`No target ID provided in 'ConfirmDelete' for deletion of ${targetName} (sending to ${targetUrl})`);
  }

  function handleDelete() {
    // Check if the input matches the target name
    if ((document.getElementById(`delete-name-input-${elementId}`) as HTMLInputElement)?.value !== targetName || !(document.getElementById(`delete-name-input-${elementId}`) as HTMLInputElement)?.value) {
      return;
    }
    setIsLoading(true);
    if (!targetId) {
      alert("Deletion failed: No target ID provided. This shouldn't happen, so please report this to the developers.");
      console.error(`No target ID provided in 'ConfirmDelete' for deletion of ${targetName} (sending to ${targetUrl})`);
    } else if (typeof targetId === "string") {
      formSubmitter(targetUrl, JSON.stringify({ id: targetId }), "DELETE", t, setIsLoading);
    } else if (typeof targetId === "object") {
      formSubmitter(targetUrl, JSON.stringify(targetId), "DELETE", t, setIsLoading, window?.location?.href);
    }
    closeModal(modalRef);
  };

  return (
    <dialog 
      closedby="any"
      ref={modalRef} 
      aria-modal={true} 
      className={`rounded padding-inline-0 padding-block-0 ${styles['dialog']}`}
      style={{width: 'min(75ch, 100%)', height: 'calc(-2rem + 50vh)', fontSize: 'initial'}}
    >
      <div className={`${styles['dialog-content']}`}>
        <div className={`${styles['dialog-header']}`}>
          {/* Close button */}
          <button className="grid round padding-50 transparent" disabled={isLoading} onClick={() => closeModal(modalRef)} autoFocus={true} aria-label={t("common:tsx.close")} >
            <IconX aria-hidden="true" width={28} height={28} strokeWidth={3} style={{ minWidth: '28px' }} />
          </button>

          {/* Title */}
          <h2 className="margin-0">{t("components:confirm_delete.delete_post")}</h2>
        </div>
        <form onSubmit={handleDelete} className="padding-100 flex flex-direction-column" style={{minHeight: '0'}}>
          <div className="flex-grow-100">
            <p className="margin-0" >
              <Trans
                i18nKey={"components:confirm_delete.confirmation"}
                values={{ targetName: targetName }}
                components={{ strong: <strong />, br: <br /> }}
              />
            </p>
            <label className="block margin-block-75">
              <Trans
                i18nKey={"components:confirm_delete.type_to_confirm"}
                values={{ targetName: targetName }}
                components={{ strong: <strong /> }}
              />
              <input className="margin-block-25" type="text" placeholder={targetName} id={`delete-name-input-${elementId}`} required={true} pattern={targetName} />
            </label>
          </div>
          <div className="flex gap-25">
            <button type="button" className="font-weight-500 flex-grow-100" onClick={() => closeModal(modalRef)}>{t("common:tsx.cancel")}</button>
            <button type="submit" className="color-purewhite red font-weight-500" disabled={isLoading} onClick={handleDelete}>{t("components:confirm_delete.delete_post")}</button>
          </div>
        </form>
      </div>
    </dialog>
  );
}