"use client"

import styles from './nonModalDialog.module.css' with { type: "css" }
import { useRef } from "react";

export default  function NonModalDialog({
  dialogPosition,
  toggleButtonWidth,
  title,
  verticalAlign
}: 
  | {
      dialogPosition: "top" | "bottom";
      toggleButtonWidth: string;
      title: string,
      verticalAlign?: never;
    }
  | {
      dialogPosition: "right" | "left";
      toggleButtonWidth: string;
      title: string,
      verticalAlign: "top" | "center" | "bottom";
    }
) {
 
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
        <button onClick={toggleDialog} className={`${styles['toggle-button']}`} style={{width: toggleButtonWidth}}>
          Open Dialog
        </button>
        <div className={`${styles['dialog-arrow-indicator']}  ${styles[`dialog-arrow-indicator-${dialogPosition}`]}`}></div>
      </div>

      <dialog 
        ref={dialogRef} 
        className={`
          ${styles['non-modal-dialog']} 
          ${styles[`non-modal-dialog-${dialogPosition}`]}
          ${verticalAlign ? styles[`non-modal-dialog-vertical-${verticalAlign}`] : ''}
        `}>
        <form 
          method="dialog" 
          className='flex justify-content-space-between align-items-center gap-300 margin-25 padding-bottom-25' 
          style={{borderBottom: '1px solid var(--gray)'}} > 
          <p className='margin-0 font-weight-600'>{title}</p>
          <button 
            type="submit" 
            className="padding-25" 
            style={{backgroundColor: 'transparent', borderRadius: '9999px'}}
          >
            <img src="/icons/close.svg" className="grid" width="12" height="12" alt="close" />
          </button>
        </form>
      </dialog>
    </>
  )
}