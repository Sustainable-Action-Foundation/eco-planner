'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useContext, useState } from "react";
import { closeModal } from "@/components/modals/modalFunctions";
import styles from './modals.module.css'
import { LocaleContext } from "@/app/context/localeContext.tsx";
import { createDict } from "./modals.dict.ts";

export default function ConfirmDelete({
  modalRef,
  targetUrl,
  targetName,
  targetId,
}: {
  modalRef: React.MutableRefObject<HTMLDialogElement | null>;
  targetUrl: string;
  targetName: string;
  targetId?: string | { actionId: string, goalId: string };
}) {
  const locale = useContext(LocaleContext);
  const dict = createDict(locale).confirmDelete;

  const [isLoading, setIsLoading] = useState(false);

  function handleDelete() {
    // Check if the input matches the target name
    if ((document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value !== targetName || !(document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value) {
      return;
    }
    setIsLoading(true);
    if (!targetId) {
      alert(`${dict.deletionFailed}`);
      console.error(`No target ID provided in 'ConfirmDelete' for deletion of ${targetName} (sending to ${targetUrl})`);
    } else if (typeof targetId === "string") {
      formSubmitter(targetUrl, JSON.stringify({ id: targetId }), "DELETE", setIsLoading)
    } else if (typeof targetId === "object") {
      formSubmitter(targetUrl, JSON.stringify(targetId), "DELETE", setIsLoading)
    }
    closeModal(modalRef);
  };

  return (
    <dialog ref={modalRef} className={styles.modal}>
      <form onSubmit={handleDelete}>
        <strong className="block" style={{ fontSize: 'larger' }}>{dict.deletePost}</strong>
        <p className="padding-block-100" style={{ borderBlock: '2px solid var(--gray-90)' }}>
          {dict.areYouSure} <strong>{targetName}</strong>? <br />
          {dict.youCannotUndo}
        </p>
        <label className="block margin-block-75">
          {dict.type} <strong>{targetName}</strong> {dict.toConfirm}
          <input className="margin-block-25" type="text" placeholder={targetName} id={`delete-name-input-${targetId}`} required pattern={targetName} />
        </label>
        <div className="display-flex justify-content-flex-end margin-top-75 gap-50">
          <button type="button" className="font-weight-500" onClick={() => closeModal(modalRef)}>{dict.cancel}</button>
          <button type="submit" className="red color-purewhite font-weight-500" disabled={isLoading} onClick={handleDelete}>{dict.delete}</button>
        </div>
      </form>
    </dialog>
  );
}