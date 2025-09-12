"use client"

import React, { useState } from "react";

type TabChild = React.ReactElement<{ "data-tabname": string }>;

type TabViewProps = {
  children: TabChild | TabChild[];
};

// TODO: Require children to have a tabname and a tabpanel role

export default function TabView({ children }: TabViewProps) {
  const childrenArray = React.Children.toArray(children) as TabChild[];
  const tabNames = childrenArray.map((child) => child.props["data-tabname"]);
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <>
      <div 
        role="tablist"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            setActiveIndex(activeIndex !== tabNames.length - 1 ? activeIndex + 1 : 0) // TODO: Also set focus here
          }
          if (e.key === "ArrowLeft") {
            setActiveIndex(activeIndex !== 0 ? activeIndex - 1 : tabNames.length - 1) // TODO: Also set focus here
          }
        }}
      >
        {tabNames.map((tabName, index) => 
          <button 
            role="tab" 
            key={tabName} 
            onClick={() => setActiveIndex(index)}
            tabIndex={index === activeIndex ? 0 : -1}  
          >
            {tabName}
          </button>
        )}
      </div>
      {childrenArray[activeIndex]}
    </>);
}
