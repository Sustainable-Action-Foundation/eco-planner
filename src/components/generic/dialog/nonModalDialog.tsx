"use client"

import styles from './nonModalDialog.module.css' with { type: "css" }
import { useRef } from "react";
import React from "react";
import { IconWorld, IconX } from "@tabler/icons-react"

// TODO: Do i even need a popoverbutton component actually?
export function PopoverButton({
  id,
  className,
  style,
  children,
  anchorName,
  popoverTarget
}: {
  id?: string,
  className?: string,
  style?: React.CSSProperties,
  children?: React.ReactNode,
  anchorName: string,
  popoverTarget: string
}) {
  return (
    <button
      id={id}
      className={`${styles['anchor-name']} ${className}`}
      style={{ '--anchor-name': anchorName, ...style, } as React.CSSProperties} // TODO: Do i need React.Cssproperties here?
      popoverTarget={popoverTarget}
    >
      {children}
    </button>
  )
}

// TODO: A horizontal popover direction should only be 
// Given assuming an anchorInlinePosition of center
export function Popover({
  id,
  className,
  style,
  children,
  popover,
  anchorInlinePosition,
  popoverDirection
}: {
  id: string,
  className?: string,
  style?: React.CSSProperties,
  children?: React.ReactNode,
  popover: "" | "auto" | "manual" | undefined,
  anchorInlinePosition: 'start' | 'center' | 'end',
  popoverDirection: {
    vertical: 'up' | 'vertical' | 'down',
    horizontal?: 'left' | 'right'
  } | 'up' | 'vertical' | 'down'
}) {
  return (
    <div
      id={id}
      className={`
        ${styles[`anchor-inline-${anchorInlinePosition}`]} 
        ${typeof popoverDirection === 'string' ?
          styles[`popover-direction-${popoverDirection}`]
          :
          `${styles[`popover-direction-${popoverDirection.vertical}`]} 
          ${popoverDirection.horizontal ? styles[`popover-direction-${popoverDirection.horizontal}`] : ''}`
        }   
        ${className ?? ''}
      `}
      style={{ ...style }}
      popover={popover}
    >
      {children}
    </div>
  )
}

export default function NonModalDialog({
  dialogPosition,
  toggleButtonWidth,
  title,
  buttonTitle,
  verticalAlign,
  margin,
  children
}:
  | {
    dialogPosition: "top" | "bottom";
    verticalAlign?: never;
    toggleButtonWidth: string;
    title: string,
    buttonTitle: string,
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
    verticalAlign: "top" | "center" | "bottom"; // TODO: Add horizontal align (left, center, right)?
    toggleButtonWidth: string;
    title: string,
    buttonTitle: string,
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
        {/* TODO: We primarily implemented this for translation menu */}
        {/* Adapt button image and text to a broader usage later (and style appropriately)*/}
        <button
          onClick={toggleDialog}
          className={`${styles['toggle-button']} align-items-center font-weight-500`}
          style={{ width: toggleButtonWidth, fontSize: '1rem' }}
        >
          <IconWorld aria-hidden="true" style={{ minWidth: "24px" }} />
          {buttonTitle}
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
          className='flex justify-content-space-between align-items-center gap-300 margin-block-25 margin-inline-50 padding-bottom-25'
          style={{ borderBottom: '1px solid var(--gray)' }} >
          <h2
            id={`dialog-${title.replace(' ', '').toLowerCase()}-title`}
            className='margin-0 font-weight-600'
            style={{ whiteSpace: 'nowrap', fontSize: '1rem' }}>
            {title}
          </h2>
          {/* TODO: i18n */}
          <button
            type="submit"
            className="padding-25"
            style={{ backgroundColor: 'transparent', borderRadius: '9999px' }}
            aria-label="Close dialog"
          >
            <IconX width={16} height={16} aria-hidden="true" className='grid' />
          </button>
        </form>
        {children}
      </dialog>
    </>
  )
}
