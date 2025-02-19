'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useState } from "react";
import { closeModal } from "@/components/modals/modalFunctions";
import styles from './modals.module.css'
import dict from "./confirmDelete.dict.json" assert { type: "json" };
import { useClientLocale, validateDict } from "@/functions/clientLocale";

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
  validateDict(dict);
  const locale = useClientLocale();
  const [isLoading, setIsLoading] = useState(false);

  function handleDelete() {
    // Check if the input matches the target name
    if ((document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value !== targetName || !(document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value) {
      return;
    }
    setIsLoading(true);
    if (!targetId) {
      alert(`${dict.deletionFailed[locale]}`);
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
        <strong className="block" style={{ fontSize: 'larger' }}>{dict.deletePost[locale]}</strong>
        <p className="padding-block-100" style={{ borderBlock: '2px solid var(--gray-90)' }}>
          {dict.areYouSure[locale]} <strong>{targetName}</strong>? <br />
          {dict.youCannotUndo[locale]}
        </p>
        <label className="block margin-block-75">
          {dict.type[locale]} <strong>{targetName}</strong> {dict.toConfirm[locale]}
          <input className="margin-block-25" type="text" placeholder={targetName} id={`delete-name-input-${targetId}`} required pattern={targetName} />
        </label>
        <div className="display-flex justify-content-flex-end margin-top-75 gap-50">
          <button type="button" className="font-weight-500" onClick={() => closeModal(modalRef)}>{dict.cancel[locale]}</button>
          <button type="submit" className="red color-purewhite font-weight-500" disabled={isLoading} onClick={handleDelete}>{dict.delete[locale]}</button>
        </div>
      </form>
    </dialog>
  );
}