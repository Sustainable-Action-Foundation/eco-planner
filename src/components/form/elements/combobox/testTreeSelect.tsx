"use client"

import { testTreeItem } from "@/components/types"
import { IconCaretRightFilled } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { handleKeyDownTreeCombobox } from "./functions";

// TODO: Set focus when using arrowRight/left or when clicking an item. 
// Should be able to just setFocusedIndex(flattenedItems.find(item)) or similar

/**
 * Flattens an array of treeItems so children appear right after their parent.
 */
function flattenTree(items: Array<testTreeItem>) {
  const result: Array<testTreeItem> = [];

  function traverse(node: testTreeItem) {
    result.push(node);

    if (node.expanded && node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(traverse);
    }
  }

  items.forEach(traverse);
  return result;
}
function updateNodeInTree(
  items: Array<testTreeItem>,
  targetValue: string,
  updater: (node: testTreeItem) => testTreeItem
): Array<testTreeItem> {
  return items.map(item => {
    if (item.value === targetValue) {
      return updater(item);
    }
    if (item.childNodes && item.childNodes.length > 0) {
      return {
        ...item,
        childNodes: updateNodeInTree(item.childNodes, targetValue, updater),
      };
    }
    return item;
  });
}

// TODO: I Essentially need to flatten my array of tree items in order to effectively iterate throughout it.
// I can then update this flattened array once an item is expanded or closed and that should be it ?
export default function TestTreeSelect({
  treeItems,
}: {
  treeItems: Array<testTreeItem>
}) {


  const [expanded, setExpanded] = useState<boolean>(false)

  const [items, setItems] = useState<Array<testTreeItem>>(treeItems)
  const [flattenedItems, setFlattenedItems] = useState<Array<testTreeItem>>(flattenTree(treeItems))
  // const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  useEffect(() => {
    setFlattenedItems(flattenTree(items))
  }, [items])

  useEffect(() => {
    if (focusedIndex == null) return
    const selectedItem = flattenedItems[focusedIndex]
    const selectedItemElement = document.getElementById(`treeitem-${selectedItem.name.replace(' ', '-')}-${selectedItem.value.replace(' ', '-')}`)

    if (!selectedItemElement) return
    selectedItemElement.style.color = "red"

  }, [focusedIndex, flattenedItems])

  const handleUpdateNode = (value: string, updater: (n: testTreeItem) => testTreeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  async function toggleNode(item: testTreeItem) {
    if (item.onExpand && !item.childNodes) {
      const children = await item.onExpand();
      handleUpdateNode(item.value, node => ({
        ...node,
        childNodes: children,
        expanded: true,
      }));
      console.log(item)
    } else {
      handleUpdateNode(item.value, node => ({
        ...node,
        expanded: !node.expanded,
      }));
      console.log(item)
    }
  };

  function TreeNode({ item, onUpdate }: { item: testTreeItem, onUpdate: (value: string, updater: (n: testTreeItem) => testTreeItem) => void }) {
    return (
      <li className="padding-block-25" id={`treeitem-${item.name.replace(' ', '-')}-${item.value.replace(' ', '-')}`} >
        <span onClick={() => void toggleNode(item)}>
          {(item.onExpand || (item.childNodes && item.childNodes.length > 0)) ?
            <IconCaretRightFilled style={{ verticalAlign: 'bottom' }} /> :
            <IconCaretRightFilled fill="lightgrey" style={{ verticalAlign: 'bottom' }} />
          }
          {item.name}
        </span>
        {item.expanded && item.childNodes && (
          <ul style={{ listStyle: 'none' }} className="margin-0 padding-inline-start-100">
            {item.childNodes.map((child, index) => (
              <TreeNode key={index} item={child} onUpdate={onUpdate} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="position-relative">
      <button type="button" onClick={() => setExpanded(!expanded)}>
        Expand
      </button>

      <div
        style={{
          userSelect: 'none',
          padding: '.25rem',
          display: expanded ? "block" : "none",
          position: "absolute",
          top: "100%",
          left: "0",
          backgroundColor: 'white',
          border: '1px solid var(--gray)',
          zIndex: '9999'
        }}
      >
        <input type="text"
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            handleKeyDownTreeCombobox(
              e,
              focusedIndex,
              setFocusedIndex,
              flattenedItems,
              (item, direction) => {
                if (direction === "right" && !item.expanded) {
                  void toggleNode(item);
                }
                if (direction === "left" && item.expanded) {
                  void toggleNode(item);
                }
              }
            )
          }}
        />
        <ul style={{ listStyle: 'none' }} className="margin-0 padding-50">
          {items.map((treeItem, index) => (
            <TreeNode key={index} item={treeItem} onUpdate={handleUpdateNode} />
          ))}
        </ul>
      </div>
    </div>
  )
}