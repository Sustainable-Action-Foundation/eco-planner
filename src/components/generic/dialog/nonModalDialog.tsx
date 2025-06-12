"use client"

import styles from './nonModalDialog.module.css' with { type: "css" }
import { useEffect, useRef } from "react";
import React from "react";
import { IconWorld, IconX } from "@tabler/icons-react"

interface NonModalDialogButtonProps {
  id: string,
  className?: string,
  style?: React.CSSProperties;
  children?: React.ReactNode,
  onToggleDialog?: () => void;
  dialogPosition: "top" | "right" | "bottom" | "left";
  indicatorMargin: string
}

interface NonModalDialogProps {
  id?: string,
  className?: string,
  style?: React.CSSProperties;
  children?: React.ReactNode;
  dialogRef?: React.RefObject<HTMLDialogElement | null>;
}

export function NonModalDialogWrapper({
  children
}: {
  children: [
    React.ReactElement<NonModalDialogButtonProps>,
    React.ReactElement<NonModalDialogProps>
  ]; // expect only button and dialog as the children
}) {

  // Pass ref to dialog child
  const dialogRef = useRef<HTMLDialogElement>(null);

  // function to toggle dialog child using ref 
  const toggleDialog = () => {
    if (!dialogRef.current) return;
    if (!dialogRef.current.open) {
      dialogRef.current.show();
    } else {
      dialogRef.current.close();
    }
  };

  // Clone the button to inject the toggle handler
  // Clone the dialog to inject the ref
  const [button, dialog] = children;
  const buttonWithProps = React.cloneElement(button, { onToggleDialog: toggleDialog });
  const dialogWithProps = React.cloneElement(dialog, { dialogRef });

  return (
    <>
      {buttonWithProps}
      {dialogWithProps}
    </>
  );
}

export function NonModalDialogButton({
  id,
  className,
  style,
  children,
  onToggleDialog,
  dialogPosition,
  indicatorMargin,
}: NonModalDialogButtonProps) {

  // TODO: This useEffect can be removed once nextjs support anchor-name within inline styles
  useEffect(() => {
    const toggle_dialog_button = document.getElementById(id)
    const toggle_dialog_button_indicator = document.getElementById(`${id}-indicator`)
    if (toggle_dialog_button && toggle_dialog_button_indicator) {
      toggle_dialog_button.style.setProperty('anchor-name', `--${id}`)
      toggle_dialog_button_indicator.style.setProperty('--position-anchor', `--${id}`)
    }
  })

  return (
    <div className={`${styles['toggle-button-wrapper']} position-relative`}>
      <button
        id={id}
        className={`${className}`}
        style={{ ...style }}
        onClick={onToggleDialog}
      >
        {children}
      </button>
      <div
        id={`${id}-indicator`}
        className={`
          ${styles['dialog-arrow-indicator']}  
          ${styles[`dialog-arrow-indicator-${dialogPosition}`]}
        `}
        style={{
          marginTop: dialogPosition === 'bottom' ? indicatorMargin : 0,
          marginRight: dialogPosition === 'left' ? indicatorMargin : 0,
          marginBottom: dialogPosition === 'top' ? indicatorMargin : 0,
          marginLeft: dialogPosition === 'right' ? indicatorMargin : 0
        }}
      ></div>
    </div>
  )
}

export function NonModalDialogTemp({
  id,
  className,
  style,
  children,
  dialogRef,
}: NonModalDialogProps) {
  return (
    <dialog
      id={id}
      className={`${className}`}
      style={{ ...style }}
      ref={dialogRef}
    >
      {children}
    </dialog>
  );
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
          <IconWorld aria-hidden="true" style={{minWidth: "24px"}} />
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
          <button
            type="submit"
            className="padding-25"
            style={{ backgroundColor: 'transparent', borderRadius: '9999px' }}
            aria-label='Close dialog'
          >
            <IconX width={16} height={16} aria-hidden="true" className='grid' />
          </button>
        </form>
        {children}
      </dialog>
    </>
  )
}
