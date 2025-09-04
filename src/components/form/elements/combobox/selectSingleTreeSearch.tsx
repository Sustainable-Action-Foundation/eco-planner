"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconCaretRightFilled, IconSelector } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { handleKeyDownTreeCombobox } from "./functions";
import styles from './comboBox.module.css' with { type: "css" }


/**
 * Flattens an array of treeItems so children appear right after their parent.
 */
function flattenTree(items: Array<treeItem>) {
  const result: Array<treeItem> = [];

  function traverse(node: treeItem) {
    result.push(node);

    if (node.expanded && node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(traverse);
    }
  }

  items.forEach(traverse);
  return result;
}
function updateNodeInTree(
  items: Array<treeItem>,
  targetValue: string,
  updater: (node: treeItem) => treeItem
): Array<treeItem> {
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
export default function SelectSingleTreeSearch({
  treeItems,
  props
}: {
  treeItems: Array<treeItem>,
  props: inputElement,
}) {


  const [menuOpen, setMenuOpen] = useState<boolean>(false)

  const [items, setItems] = useState<Array<treeItem>>(treeItems)
  const [flattenedItems, setFlattenedItems] = useState<Array<treeItem>>(flattenTree(treeItems))
  // const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null); // TODO: Rename?

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

  const handleUpdateNode = (value: string, updater: (n: treeItem) => treeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  async function toggleNode(item: treeItem) {
    const index = flattenedItems.findIndex(el => el.value === item.value);
    setFocusedIndex(index)
    if (item.onExpand && !item.childNodes) {
      const children = await item.onExpand();
      handleUpdateNode(item.value, node => ({
        ...node,
        childNodes: children,
        expanded: true,
      }));
    } else {
      handleUpdateNode(item.value, node => ({
        ...node,
        expanded: !node.expanded,
      }));
    }
  };

  function TreeNode({ item, onUpdate }: { item: treeItem, onUpdate: (value: string, updater: (n: treeItem) => treeItem) => void }) {
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
      <button
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        // value={value ? value.value : ''}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef}
        onClick={() => { setMenuOpen(!menuOpen) }}
        role="combobox"
        type="button"
        aria-controls={menuOpen ? `${props.id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-required={props.required ? props.required : false}
        // aria-invalid={!valueIsValid}
      >
        Expand
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>

      <div
        style={{
          userSelect: 'none',
          padding: '.25rem',
          display: menuOpen ? "block" : "none",
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