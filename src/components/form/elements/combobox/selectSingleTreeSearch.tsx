"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconCaretRightFilled, IconSearch, IconSelector } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { clearEditableCombobox, handleKeyDownTreeCombobox } from "./functions";
import styles from './comboBox.module.css' with { type: "css" }
import { useTranslation } from "react-i18next";
import Image from "next/image"

// TODO: Aria-setsize (How do we deal with this given async functions)
// TODO: Aria-posinset (How do we deal with this given async functions)
// TODO: Should allow for options with same values? Or we should check that they are unique?

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
  props,
  onChange
}: {
  treeItems: Array<treeItem> ,
  props: inputElement,
  onChange?: (value: treeItem | null) => void 
}) {

  const { t } = useTranslation(["forms"]);
  const [value, setValue] = useState<treeItem | null>(null)
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [searchValue, setSearchValue] = useState<string>('')

  const [items, setItems] = useState<Array<treeItem>>(treeItems)
  const [flattenedItems, setFlattenedItems] = useState<Array<treeItem>>(flattenTree(treeItems))
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null); // TODO: Rename?
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!onChange) return
    onChange(value)
  }, [value, onChange])

  useEffect(() => {
    setFlattenedItems(flattenTree(items))
  }, [items])

  useEffect(() => {
    if (focusedIndex == null) return
    const selectedItem = flattenedItems[focusedIndex]
    const selectedItemElement = document.getElementById(`${props.id}-dialog-tree-${selectedItem.name.replace(' ', '-')}`)
    if (!selectedItemElement) return

    const selectedItemElementText = selectedItemElement.querySelector<HTMLDivElement>(':scope > div')
    if (!selectedItemElementText) return

    selectedItemElementText.style.backgroundColor = "var(--gray-90)" // TODO: See if we can replace this using the focused-option class

  }, [focusedIndex, flattenedItems, props.id])

  useEffect(() => { 
    if (!searchRef.current) return
    clearEditableCombobox(
      searchRef.current,
      setSearchValue,
      menuOpen,
      setFocusedIndex
    ) 
  }, [menuOpen]);

  /* Why do i need this? */
  useEffect(() => {
    setItems(treeItems);
    setFlattenedItems(flattenTree(treeItems));
  }, [treeItems]);

  const handleUpdateNode = (value: string, updater: (n: treeItem) => treeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  async function toggleNode(item: treeItem) {
    const index = flattenedItems.findIndex(el => el.value === item.value);
    setFocusedIndex(index) // TODO: I do not think we do this when selecting without running this function (i.e onclick), see if i can implement it

    if (item.onExpand && !item.childNodes) {
      setLoading(true);
      const children = await item.onExpand();
      handleUpdateNode(item.value, node => ({
        ...node,
        childNodes: children,
        expanded: true,
      }));
      setLoading(false);
    } else {
      handleUpdateNode(item.value, node => ({
        ...node,
        expanded: !node.expanded,
      }));
    }
  };

  function TreeNode({
    item,
    onUpdate,
    depth = 0
  }: {
    item: treeItem,
    onUpdate: (value: string, updater: (n: treeItem) => treeItem) => void,
    depth?: number
  }) {
    return (
      <li
        role="treeitem"
        id={`${props.id}-dialog-tree-${item.name.replace(' ', '-')}`}
        aria-level={depth + 1}
        aria-selected={(item.expanded === null || item.onExpand === undefined) && item.value === value?.value}
        aria-expanded={
          (item.expanded !== null || item.onExpand !== undefined)
            ? !!item.expanded
            : undefined}
      >
        <div
          className={`flex gap-25 align-items-center justify-content-space-between`}
          style={{
            paddingLeft: item.expanded === null ? '1.25rem' : ''
          }}
          onClick={
            item.expanded !== null || item.onExpand !== undefined
              ? () => {void toggleNode(item); searchRef.current?.focus()}
              : () => {setValue(item?.value !== value?.value ? item : null); setMenuOpen(false)}
          }
        >
          {(item.onExpand || (item.childNodes && item.childNodes.length > 0))
            ? <span className="flex gap-25 align-items-center">
              {loading ?
                <Image // TODO: need to keep track of this specific item loading state. Right now all icons will be loaders
                  src='/loaders/ring-resize.svg'
                  alt=""
                  width={16}
                  height={16}
                />
                :
                <IconCaretRightFilled
                  width={16}
                  height={16}
                  style={{
                    minWidth: '16px',
                    transform: item.expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease', // TODO: explore why this does not seem to work.
                  }}
                />
              }
              {item.name}
            </span>
            : item.name
          }

        </div>
        {item.expanded && item.childNodes && (
          <ul
            role="group"
            style={{ listStyle: 'none' }}
            className="margin-0 padding-inline-start-75"
          >
            {item.childNodes.map((child, index) => (
              <TreeNode key={index} item={child} onUpdate={onUpdate} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none' }} 
    >
      <button // TODO: Should this and select inptus be an input with type button? Might make floating labels easier? 
        title={value?.name}
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        value={value ? value.value : ''}
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
        <span className={`${styles['selected-value-text']}`}>
          {!value ? props.placeholder : value.name}
        </span>
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>

      <div
        id={`${props.id}-dialog`}
        className={`              
          ${styles['tree']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id != props.id) {
            setFocusedIndex(null)
            setMenuOpen(false);
          }
        }}
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
          <input
            type="text"
            style={{ padding: '0', margin: '0', fontSize: 'revert' }}
            ref={searchRef}
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
                },
                (selectedTreeItem) => {
                  if (!selectedTreeItem) return
                  if (selectedTreeItem.expanded !== null || selectedTreeItem.onExpand !== undefined) {
                    void toggleNode(selectedTreeItem)
                  } else {
                    setValue(selectedTreeItem?.value !== value?.value ? selectedTreeItem : null); // TODO: Abstract this to use in onclick     
                    setMenuOpen(false);
                    toggleRef.current?.focus();
                  }
                }
              )
            }}
            role="combobox"
            aria-controls={`${props.id}-dialog-tree`}
            // aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            // aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("common:tsx.search") + t("common:tsx.ellipsis")}
          />
        </label>
        <ul
          id={`${props.id}-dialog-tree`}
          className="margin-0 padding-0"
          role="tree"
          aria-label={t("common:tsx.options")}
        >
          {items.map((treeItem, index) => (
            <TreeNode key={index} item={treeItem} onUpdate={handleUpdateNode} />
          ))}
        </ul>
      </div>
    </div>
  )
}