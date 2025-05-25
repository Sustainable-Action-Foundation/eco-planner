"use client"

import styles from './nonModalDialog.module.css' with { type: "css" }
import { useRef } from "react";

export default  function NonModalDialog({
  dialogPosition
}: {
  dialogPosition: "top" | "right" | "bottom" | "left";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const toggleDialog = () => {
    if (!dialogRef.current) return;
    if (!dialogRef.current.open) {
      dialogRef.current.show();
      return
    } 
    dialogRef.current.close();
  };

  return ( 
    <>
      <div className={`${styles['toggle-button-wrapper']} position-relative`}>
        <button onClick={toggleDialog} className={`${styles['toggle-button']}`}>
          Open Dialog
        </button>
        <div className={`${styles['dialog-arrow-indicator']}  ${styles[`dialog-arrow-indicator-${dialogPosition}`]}`}></div>
      </div>

      <dialog ref={dialogRef}>
        <form method="dialog" > 
          <button type="submit" className="padding-25" style={{backgroundColor: 'transparent', borderRadius: '9999px'}}>
            <img src="/icons/close.svg" className="grid" width="16" height="16" alt="close" />
          </button>
        </form>
      </dialog>
    </>
  )
}