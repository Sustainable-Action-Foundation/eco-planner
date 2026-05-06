"use client"

import type { TabProps, TabPanelProps, GenericElement } from "@/components/types"
import React, { useEffect, useRef, useState } from "react"

// TODO: Rename file
// TODO: Aria-controls
const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  ({ className, style, tabIndex, selected, children, onClick }, ref) => (
    <button
      className={className}
      style={style}
      ref={ref}
      tabIndex={tabIndex}
      aria-selected={selected}
      onClick={onClick}
      role="tab"
    >
      {children}
    </button>
  ),
)
Tab.displayName = "Tab"

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, style, children, hidden }, ref) => (
    <div
      className={className}
      style={style}
      ref={ref}
      hidden={hidden}
      role="tabpanel"
    >
      {children}
    </div>
  ),
)
TabPanel.displayName = "TabPanel"

/** Type guard */
function isForwardRefWithDisplayName<P>(
  element: React.ReactNode,
  displayName: string,
): element is React.ReactElement<P> {
  if (!React.isValidElement(element)) return false

  const type = element.type

  return (
    (typeof type === "function" || typeof type === "object") &&
    "displayName" in type &&
    type.displayName === displayName
  )
}

function TabList({ props, children }: { props?: GenericElement, children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const childrenArray = React.Children.toArray(children)

  const tabs = childrenArray.filter(
    (child): child is React.ReactElement<TabProps> =>
      isForwardRefWithDisplayName<TabProps>(child, "Tab"),
  )

  const panels = childrenArray.filter(
    (child): child is React.ReactElement<TabPanelProps> =>
      isForwardRefWithDisplayName<TabPanelProps>(child, "TabPanel"),
  )
  const tabListRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (activeIndex === null) return
    const tabListElement = tabListRef.current
    if (!tabListElement) return

    const tabElements = tabListElement.querySelectorAll<HTMLButtonElement>("[role='tab']")
    tabElements[activeIndex]?.focus()
  }, [activeIndex])

  return (
    <div>
      <div
        ref={tabListRef}
        className={props?.className}
        style={props?.style}
        role="tablist"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            if (activeIndex === null) {
              setActiveIndex(1)
            } else {
              setActiveIndex(activeIndex !== tabs.length - 1 ? activeIndex + 1 : 0)
            }
          }
          if (e.key === "ArrowLeft") {
            if (activeIndex === null) {
              setActiveIndex(tabs.length - 1)
            } else {
              setActiveIndex(activeIndex !== 0 ? activeIndex - 1 : tabs.length - 1)
            }
          }
          if (e.key === "Home") {
            e.preventDefault()
            setActiveIndex(0)
          }
          if (e.key === "End") {
            e.preventDefault()
            setActiveIndex(tabs.length - 1)
          }
        }}
      >
        {tabs.map((tab, index) =>
          React.cloneElement(tab as React.ReactElement<TabProps & React.RefAttributes<HTMLButtonElement>>, {
            tabIndex: activeIndex === null
              ? index === 0
                ? 0
                : -1
              : index === activeIndex
                ? 0
                : -1,
            selected: activeIndex === null
              ? index === 0
                ? true
                : false
              : index === activeIndex
                ? true
                : false,
            onClick: () => setActiveIndex(index),
            key: index,
          }),
        )}
      </div>
      <div>
        {panels.map((panel, index) =>
          React.cloneElement(panel, {
            hidden: activeIndex === null ? index !== 0 : index !== activeIndex,
            key: index,
          }),
        )}
      </div>
    </div>
  )
}

TabList.Tab = Tab
TabList.TabPanel = TabPanel

export default TabList