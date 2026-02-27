"use client"

import { TabProps, TabPanelProps } from "@/components/types"
import React, { useState } from "react"


const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  ({ children, onClick }, ref) => (
    <button ref={ref} onClick={onClick} role="tab">
      {children}
    </button>
  )
)
Tab.displayName = "Tab"

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ children, hidden }, ref) => (
    <div ref={ref} hidden={hidden} role="tabpanel">
      {children}
    </div>
  )
)
TabPanel.displayName = "TabPanel"

/** Type guard */
function isForwardRefWithDisplayName<P>(
  element: React.ReactNode,
  displayName: string
): element is React.ReactElement<P> {
  if (!React.isValidElement(element)) return false

  const type = element.type

  return (
    (typeof type === "function" || typeof type === "object") &&
    "displayName" in type &&
    type.displayName === displayName
  )
}

function TabList({ children }: { children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0)

  const childrenArray = React.Children.toArray(children)

  const tabs = childrenArray.filter(
    (child): child is React.ReactElement<TabProps> =>
      isForwardRefWithDisplayName<TabProps>(child, "Tab")
  )

  const panels = childrenArray.filter(
    (child): child is React.ReactElement<TabPanelProps> =>
      isForwardRefWithDisplayName<TabPanelProps>(child, "TabPanel")
  )

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

TabList.Tab = Tab
TabList.TabPanel = TabPanel

export default TabList