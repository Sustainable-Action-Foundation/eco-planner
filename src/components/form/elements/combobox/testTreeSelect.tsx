"use client"

import { testTreeItem, treeItem } from "@/components/types"
import { IconCaretDown, IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import { useEffect, useState } from "react"


/**
 * Flattens an array of treeItems so children appear right after their parent.
 * @param {Array<treeItem>} items 
 * @returns {Array<treeItem>}
 */
function flattenTree(items: Array<testTreeItem>) {
  const result: Array<testTreeItem> = [];

  function traverse(node: testTreeItem) {
    // Add the current node without its children (to avoid recursion inside result)
    const { childNodes, ...rest } = node;
    result.push({ ...rest, childNodes: [] });

    // Recursively add children
    if (node.expanded && childNodes && childNodes.length > 0) {
      childNodes.forEach(traverse);
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

  useEffect(() => {
    setFlattenedItems(flattenTree(items))
  }, [items])

  const handleUpdateNode = (value: string, updater: (n: testTreeItem) => testTreeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  const TreeNode = ({ item, onUpdate }: { item: testTreeItem, onUpdate: (value: string, updater: (n: testTreeItem) => testTreeItem) => void }) => {
    const handleClick = async () => {
      if (item.onExpand && (!item.childNodes || item.childNodes.length === 0)) {
        const children = await item.onExpand();
        onUpdate(item.value, node => ({
          ...node,
          childNodes: children,
          expanded: true,
        }));
      } else {
        onUpdate(item.value, node => ({
          ...node,
          expanded: !node.expanded,
        }));
      }
    };

    return (
      <li className="padding-block-25">
        {item.onExpand || (item.childNodes && item.childNodes.length > 0) ?
          <IconCaretRightFilled style={{ verticalAlign: 'bottom' }} /> :
          <IconCaretRightFilled fill="lightgrey" style={{ verticalAlign: 'bottom' }} />
        }
        <span onClick={handleClick}>
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
        <input type="text" />
        <ul style={{ listStyle: 'none' }} className="margin-0 padding-50">
          {treeItems.map((treeItem, index) => (
            <TreeNode key={index} item={treeItem} onUpdate={handleUpdateNode} />
          ))}
        </ul>
      </div>
    </div>
  )
}