"use client"

import React, { useEffect, useRef, useState } from "react";

type TabChild = React.ReactElement<{ "data-tabname": string, "id": string }>;

type TabViewProps = {
  children: TabChild | TabChild[];
};

// TODO: Require children to have a tabname and a tabpanel role

export default function TabView({ children }: TabViewProps) {
  const childrenArray = React.Children.toArray(children) as TabChild[];
  const tabNames = childrenArray.map((child) => child.props["data-tabname"]);
  const tabIds = childrenArray.map((child) => child.props["id"]);

  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    tabRefs.current[activeIndex]?.focus()
  }, [activeIndex, tabRefs])

  return (
    <>
      <div
        role="tablist"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            setActiveIndex(activeIndex !== tabNames.length - 1 ? activeIndex + 1 : 0)
          }
          if (e.key === "ArrowLeft") {
            setActiveIndex(activeIndex !== 0 ? activeIndex - 1 : tabNames.length - 1)
          }
          if (e.key === "Home") {
            e.preventDefault()
            setActiveIndex(0)
          }
          if (e.key === "End") {
            e.preventDefault()
            setActiveIndex(tabNames.length - 1)
          }
        }}
      >
        {tabNames.map((tabName, index) =>
          <button
            role="tab"
            type="button"
            key={tabName}
            id={`${tabName}-tab`}
            ref={(el) => { tabRefs.current[index] = el }}
            onClick={() => setActiveIndex(index)}
            tabIndex={index === activeIndex ? 0 : -1}
            aria-selected={index === activeIndex}
            aria-controls={tabIds[index]}
            style={{ textTransform: "capitalize" }}
          >
            {tabName}
          </button>
        )}
      </div>
      {childrenArray[activeIndex]}
    </>);
}
