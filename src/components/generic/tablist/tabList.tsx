"use client"

import React, { useEffect, useRef, useState } from "react";
import styles from './tablist.module.css' with { type: "css" }
import { genericElement } from "@/components/types";

type TabChild = React.ReactElement<{ "data-tabname": string, "id": string }>;

type TabListProps = {
  props?: genericElement;
  styling?: "simple" | "default",
  defaultIndex: number,
  children: TabChild | TabChild[];
  menuItems?: React.ReactNode;
};

export default function TabList({ props, styling, defaultIndex, children, menuItems }: TabListProps) {
  const childrenArray = React.Children.toArray(children) as TabChild[];
  const tabNames = childrenArray.map((child) => child.props["data-tabname"]);
 
  const [activeIndex, setActiveIndex] = useState(defaultIndex <= childrenArray.length - 1 ? defaultIndex : 0);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    tabRefs.current[activeIndex]?.focus()
  }, [activeIndex, tabRefs])

  return (
    <>
      <div
        className={`${props?.className ? `${props?.className} ` : ''}${styling === "simple" ? `${styles.simple} ` : ''}${styles.tablist}`}
        style={{ ...props?.style }}
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
            aria-controls={`${tabNames[index]}-tabpanel`}
            style={{ textTransform: "capitalize" }}
          >
            {tabName}
          </button>
        )}
        {menuItems ? 
          <div onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {e.stopPropagation()}} className="inline-block margin-left-50 padding-left-50" style={{borderLeft: '1px solid var(--gray-80)'}}>{menuItems}</div>
        : null }
      </div>
      {childrenArray.map((child, index) => (
        <div
          key={`${tabNames[index]}-tabpanel`}
          role="tabpanel"
          id={`${tabNames[index]}-tabpanel`}
          hidden={index !== activeIndex}
          aria-labelledby={`${tabNames[index]}-tab`}
        >
          {child}
        </div>
      ))}
    </>);
}
