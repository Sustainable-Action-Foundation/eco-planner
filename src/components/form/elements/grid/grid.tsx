import { GenericElement } from "@/components/types"
import React from "react"

/***
 * A css grid needs to be defined and passed under props for layout
 */
export default function Grid({
  props,
  columns,
  children
}: {
  props: GenericElement
  columns: Array<string>
  children: React.ReactNode
}) {
  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style }}
      role="grid"
      aria-labelledby="" // Remember to pass this in props
    >
      {columns.map((column: string, index: number) => (
        <div role="columnheader" key={index}>{column}</div>
      ))}
      {children}
    </div>
  )
}