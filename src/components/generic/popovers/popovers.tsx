"use client"

import styles from './popovers.module.css' with { type: "css" }
import React from "react";

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
  positionAnchor,
  anchorInlinePosition,
  popoverDirection
}: {
  id: string,
  className?: string,
  style?: React.CSSProperties,
  children?: React.ReactNode,
  popover: "" | "auto" | "manual" | undefined,
  positionAnchor: string,
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
        ${styles['position-anchor']} 
        ${className ?? ''}
      `}
      style={{ '--position-anchor': positionAnchor, ...style, } as React.CSSProperties} // TODO: Do i need React.Cssproperties here?
      popover={popover}
    >
      {children}
    </div>
  )
}
