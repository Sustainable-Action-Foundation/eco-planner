"use client"

import styles from './nonModalDialog.module.css' with { type: "css" }
import { useRef } from "react";

export default  function NonModalDialog({
  dialogPosition,
  toggleButtonWidth,
  title,
  verticalAlign,
  margin,
  children
}: 
  | {
      dialogPosition: "top" | "bottom";
      verticalAlign?: never;
      toggleButtonWidth: string;
      title: string,
      margin: {
        top: string, 
        right: string, 
        bottom: string, 
        left: string
      },
      children?: React.ReactNode,
    }
  | {
      dialogPosition: "right" | "left";
      verticalAlign: "top" | "center" | "bottom";
      toggleButtonWidth: string;
      title: string,
      margin: {
        top?: string, 
        right?: string, 
        bottom?: string, 
        left?: string
      },
      children?: React.ReactNode,
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
        <div 
          className={`
            ${styles['dialog-arrow-indicator']}  
            ${styles[`dialog-arrow-indicator-${dialogPosition}`]}
          `}
          style={{
            marginTop: `calc(${margin.top} - 1rem)`,
            marginRight: `calc(${margin.right} - 1rem)`,
            marginBottom: `calc(${margin.bottom} - 1rem)`,
            marginLeft: `calc(${margin.left} - 1rem)`
          }}
        ></div>
      </div>

      {/* TODO: I18n for all this */}
      <dialog 
        aria-labelledby={`dialog-${title.replace(' ', '').toLowerCase()}-title`}
        ref={dialogRef} 
        className={`
          ${styles['non-modal-dialog']} 
          ${styles[`non-modal-dialog-${dialogPosition}`]}
          ${verticalAlign ? styles[`non-modal-dialog-vertical-${verticalAlign}`] : ''}
        `}
        style={{
          margin: `${margin.top} ${margin.right} ${margin.bottom} ${margin.left}`
        }}
      >
        <form 
          method="dialog" 
          className='flex justify-content-space-between align-items-center gap-300 margin-25 padding-bottom-25' 
          style={{borderBottom: '1px solid var(--gray)'}} > 
          <h2
            id={`dialog-${title.replace(' ', '').toLowerCase()}-title`}
            className='margin-0 font-weight-600' 
            style={{whiteSpace: 'nowrap', fontSize: '1rem'}}>
              {title}
          </h2>
          <button 
            type="submit" 
            className="padding-25" 
            style={{backgroundColor: 'transparent', borderRadius: '9999px'}}
          >
            <img src="/icons/close.svg" className="grid" width="12" height="12" alt={`Close dialog`} />
          </button>
        </form>
        {children}
      </dialog>
    </>
  )
}