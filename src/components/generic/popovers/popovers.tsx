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
  popoverDirection,
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
  indicator?: boolean,
  margin?: {
    top?: string,
    right?: string,
    bottom?: string,
    left?: string, 
  }
}) {

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
            marginTop: `${margin ? `calc(${margin.top} - 1rem)` : ''}`,
            marginRight: `${margin ? `calc(${margin.right} - 1rem)` : ''}`,
            marginBottom: `${margin ? `calc(${margin.bottom} - 1rem)` : ''}`,
            marginLeft: `${margin ? `calc(${margin.left} - 1rem)` : ''}`,
            '--position-anchor': positionAnchor,
          } as React.CSSProperties}
        >
        </div>
      : null } 
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
        style={{ 
            marginTop: `${margin ? margin.top : ''}`,
            marginRight: `${margin ? margin.right : ''}`,
            marginBottom: `${margin ? margin.bottom : ''}`,
            marginLeft: `${margin ? margin.left : ''}`,
          '--position-anchor': positionAnchor, 
          ...style, 
        } as React.CSSProperties} // TODO: Do i need React.Cssproperties here?
        popover={popover}
      >
        {children}
      </div>
    </>
  )
}
