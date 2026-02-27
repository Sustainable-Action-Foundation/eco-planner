"use client"

import React, { useState } from "react"

/** Types */
type TabElement = {
  children?: React.ReactNode
}

/** Tab */
const Tab = React.forwardRef<HTMLButtonElement, TabElement & { onClick?: () => void }>(
  ({ children, onClick }, ref) => (
    <button ref={ref} onClick={onClick} role="tab">
      {children}
    </button>
  )
)
Tab.displayName = "Tab"

/** TabPanel */
const TabPanel = React.forwardRef<HTMLDivElement, TabElement & { hidden?: boolean }>(
  ({ children, hidden }, ref) => (
    <div ref={ref} hidden={hidden} role="tabpanel">
      {children}
    </div>
  )
)
TabPanel.displayName = "TabPanel"

/** Type guard for forwardRef components with displayName */
function isForwardRefWithDisplayName<P>(
  element: React.ReactNode,
  displayName: string
): element is React.ReactElement<P> {
  return (
    React.isValidElement(element) &&
    (element.type as any).displayName === displayName
  )
}

/** TabList Container */
function TabList({ children }: { children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0)

  const childrenArray = React.Children.toArray(children)

  const tabs = childrenArray.filter((child) => isForwardRefWithDisplayName(child, "Tab"))
  const panels = childrenArray.filter((child) => isForwardRefWithDisplayName(child, "TabPanel"))

  return (
    <div>
      <div role="tablist">
        {tabs.map((tab, index) =>
          React.cloneElement(tab, {
            onClick: () => setActiveIndex(index),
            key: index,
          })
        )}
      </div>
      <div>
        {panels.map((panel, index) =>
          React.cloneElement(panel, {
            hidden: index !== activeIndex,
            key: index,
          })
        )}
      </div>
    </div>
  )
}

/** Dot-notation exports */
TabList.Tab = Tab
TabList.TabPanel = TabPanel

export default TabList