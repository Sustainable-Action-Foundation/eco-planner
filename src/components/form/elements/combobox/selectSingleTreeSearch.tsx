"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconCaretRightFilled, IconSearch, IconSelector } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { handleKeyDownTreeCombobox } from "./functions";
import styles from './comboBox.module.css' with { type: "css" }
import { useTranslation } from "react-i18next";

// TODO: Aria-setsize
// TODO: Aria-posinset
// TODO: Maybe aria-level
// 

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

export default function SelectSingleTreeSearch({
  treeItems,
  props
}: {
  treeItems: Array<treeItem>,
  props: inputElement,
}) {

  const { t } = useTranslation(["forms"]);

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

    const selectedItemElementText = selectedItemElement.querySelector<HTMLSpanElement>(':scope > span')
    if (!selectedItemElementText) return

    selectedItemElementText.style.backgroundColor = "var(--gray-90)"

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
      <li
        className="padding-block-25"
        id={`treeitem-${item.name.replace(' ', '-')}-${item.value.replace(' ', '-')}`}
      >
        <span
          className={`flex gap-25 align-items-center justify-content-space-between`}
          style={{
            paddingLeft: item.expanded === null ? '1.25rem' : ''
          }}
          onClick={item.expanded !== null ? () => void toggleNode(item) : undefined} // TODO: pressing value without expand should select and set value.
        >
          {(item.onExpand || (item.childNodes && item.childNodes.length > 0))
            ? <span className="flex gap-25 align-items-center">
              <IconCaretRightFilled width={16} height={16} style={{ verticalAlign: 'bottom', minWidth: '16px' }} />
              {item.name}
            </span>
            : item.name
          }

        </span>
        {item.expanded && item.childNodes && (
          <ul style={{ listStyle: 'none' }} className="margin-0 padding-top-25 padding-inline-start-75">
            {item.childNodes.map((child, index) => (
              <TreeNode key={index} item={child} onUpdate={onUpdate} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="position-relative" style={{width: '350px'}}>
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
        className={`              
          ${styles['tree']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        tabIndex={-1}
        role="dialog"
        aria-label={t("forms:combobox.select_single_option")}
      >
        <label
          className="focusable flex align-items-center gap-25 padding-block-50 padding-inline-25"
          style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0', marginBottom: '3px' }}
          aria-label={t("forms:combobox.search_options")}
        >
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} />
          <input type="text"
            style={{ padding: '0', margin: '0', fontSize: 'revert' }}
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
        </label>
        <ul style={{ listStyle: 'none', padding: '3px' }} className="margin-0">
          {items.map((treeItem, index) => (
            <TreeNode key={index} item={treeItem} onUpdate={handleUpdateNode} />
          ))}
        </ul>
      </div>
    </div>
  )
}