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
  targetId: string | { actionId: string, goalId: string };
}) {
  const [isLoading, setIsLoading] = useState(false);

  function handleDelete() {
    // Check if the input matches the target name
    if ((document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value !== targetName || !(document.getElementById(`delete-name-input-${targetId}`) as HTMLInputElement)?.value) {
      return;
    }
    setIsLoading(true);
    if (typeof targetId === "string") {
      formSubmitter(targetUrl, JSON.stringify({ id: targetId }), "DELETE", setIsLoading)
    } else if (typeof targetId === "object") {
      formSubmitter(targetUrl, JSON.stringify(targetId), "DELETE", setIsLoading)
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
          <input className="margin-block-25" type="text" placeholder={targetName} id={`delete-name-input-${targetId}`} required pattern={targetName} />
        </label>
        <div className="display-flex justify-content-flex-end margin-top-75 gap-50">
          <button type="button" style={{ fontWeight: 500 }} onClick={() => closeModal(modalRef)}>Avbryt</button>
          <button type="submit" className="red color-purewhite" style={{ fontWeight: 500 }} disabled={isLoading} onClick={handleDelete}>Radera</button>
        </div>
      </form>
    </dialog>
  );
}