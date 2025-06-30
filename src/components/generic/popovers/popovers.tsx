// This is built as a placement agnostic component.
// However firefox does not yet support anchor positioning as of 2025-06-18
// Fallbacks for browsers which do not support anchor position places-
// any popover in the top left of the page with a height of 100%.
// As such this should only be used within the sidebar until-
// greater browser support. 

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
      style={{ '--anchor-name': anchorName, ...style, } as React.CSSProperties}
      popoverTarget={popoverTarget}
    >
      {children}
    </button>
  )
}

// TODO: A horizontal popover direction should only be 
// given assuming an anchorInlinePosition of center
export function Popover({
  id,
  className,
  style,
  children,
  popover,
  positionAnchor,
  anchorInlinePosition,
  popoverDirection,
  positionTryFallbacks,
  indicator,
  margin
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
  } | 'up' | 'vertical' | 'down',
  positionTryFallbacks?: "none" | string, // TODO: String should be a comma seperated string with suggestions on allowed fallback values. (or an array?) 
  /* 
    As of now, an indicator can only be given assuming a positionTryFallbacks of none. 
    It is likely that future browsers will support some css selector for checking fallback values,
    in which case we can support indicator for all cases and use said selector for proper alignment.
    Until then we may use :popover-open to ensure that our popover is visibly connected to a button. 
  */
  indicator?: boolean, 
  margin?: string
}) {

  // TODO: Probably prevent passing none in our types if positionTryFallbacks != "none"?
  if (positionTryFallbacks != "none") {
    indicator = undefined
  }

  // Normalize vertical direction for consistent access
  const vertical =
    typeof popoverDirection === 'string'
      ? popoverDirection
      : popoverDirection.vertical;

  // Determine indicator class based on direction and position
  let indicatorClass = '';
  if (anchorInlinePosition === 'start') {
    indicatorClass = styles['popover-indicator-left'];
  } else if (anchorInlinePosition === 'end') {
    indicatorClass = styles['popover-indicator-right'];
  } else if (anchorInlinePosition === 'center') {
    if (vertical === 'up') {
      indicatorClass = styles['popover-indicator-top'];
    } else if (vertical === 'down') {
      indicatorClass = styles['popover-indicator-bottom'];
    } else {
      indicatorClass = '';
    }
  }

  return (
    <>
      {indicator ? 
        <div 
          className={`${styles['popover-indicator']} ${indicatorClass} ${styles['position-anchor']} position-absolute`}
          style={{
            '--margin': margin,
            '--position-anchor': positionAnchor,
          } as React.CSSProperties}
        >
        </div>
      : null } 
      <div
        role='dialog'
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
        style={{ 
          '--position-try-fallbacks': positionTryFallbacks,
          '--margin': margin,
          '--position-anchor': positionAnchor, 
          ...style, 
        } as React.CSSProperties}
        popover={popover}
      >
        {children}
      </div>
    </>
  )
}
