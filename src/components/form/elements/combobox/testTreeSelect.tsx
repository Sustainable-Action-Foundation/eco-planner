"use client"

import { testTreeItem } from "@/components/types"
import { useEffect, useState } from "react"


// TODO: I Essentially need to flatten my array of tree items in order to effectively iterate throughout it.
// I can then update this flattened array once an item is expanded or closed and that should be it ?
export default function TestTreeSelect({
  treeItems,
}: {
  treeItems: Array<testTreeItem>
}) {
  const [expanded, setExpanded] = useState<boolean>(false)
  
  const TreeNode = ({ item }: { item: testTreeItem }) => {
    const [node, setNode] = useState<testTreeItem>(item)

    const handleClick = async () => {
      if (node.onExpand && !node.childNodes) {
        const children = await node.onExpand()
        setNode({
          ...node,
          childNodes: children,
          expanded: true,
        })
      } else {
        setNode(prev => ({
          ...prev,
          expanded: !prev.expanded,
        }))
      }
    }
 
    return (
      <li>
        <div onClick={handleClick}>
          {node.name}
        </div>
        {node.expanded && node.childNodes && (
          <ul>
            {node.childNodes.map((child, index) => (
              <TreeNode key={index} item={child} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="position-relative">
      <button type="button" onClick={() => setExpanded(!expanded)}>
        Expand
      </button>

      <div
        style={{
          display: expanded ? "block" : "none",
          position: "absolute",
          top: "100%",
          left: "0",
        }}
      >
        <ul>
          {treeItems.map((treeItem, index) => (
            <TreeNode key={index} item={treeItem} />
          ))}
        </ul>
      </div>
    </div>
  )
}