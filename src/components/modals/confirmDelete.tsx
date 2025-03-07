'use client';

import formSubmitter from "@/functions/formSubmitter";
import { useState } from "react";
import { closeModal } from "@/components/modals/modalFunctions";
import styles from './modals.module.css'

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
      formSubmitter(targetUrl, JSON.stringify({ id: targetId }), "DELETE", setIsLoading)
    } else if (typeof targetId === "object") {
      formSubmitter(targetUrl, JSON.stringify(targetId), "DELETE", setIsLoading, window?.location?.href)
    }
    closeModal(modalRef);
  };

  return (
    <dialog ref={modalRef} className={styles.modal}>
      <form onSubmit={handleDelete}>
        <strong className="block" style={{ fontSize: 'larger' }}>Radera inlägg</strong>
        <p className="padding-block-100" style={{ borderBlock: '2px solid var(--gray-90)' }}>
          Är du säker på att du vill radera inlägget <strong>{targetName}</strong>? <br />
          Du kan ej ångra denna åtgärd senare.
        </p>
        <label className="block margin-block-75">
          Skriv <strong>{targetName}</strong> för att bekräfta
          <input className="margin-block-25" type="text" placeholder={targetName} id={`delete-name-input-${elementId}`} required pattern={targetName} />
        </label>
        <div className="display-flex justify-content-flex-end margin-top-75 gap-50">
          <button type="button" className="font-weight-500" onClick={() => closeModal(modalRef)}>Avbryt</button>
          <button type="submit" className="red color-purewhite font-weight-500" disabled={isLoading} onClick={handleDelete}>Radera</button>
        </div>
      </form>
    </dialog>
  );
}