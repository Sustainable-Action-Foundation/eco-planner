"use client"

import type { InputElement, TreeItem } from "@/components/types"
import { IconCaretRightFilled, IconSearch, IconSelector } from "@tabler/icons-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { clearEditableCombobox, handleKeyDownTreeCombobox, preventInvalidFormSubmission } from "./functions";
import styles from './comboBox.module.css' with { type: "css" }
import { useTranslation } from "react-i18next";
import Image from "next/image"

// TODO: Aria-setsize (How do we deal with this given async functions)
// TODO: Aria-posinset (How do we deal with this given async functions)
// TODO: Should allow for options with same values? Or we should check that they are unique?

/**
 * Flattens an array of treeItems so children appear right after their parent.
 */
function flattenTree(items: Array<TreeItem>) {
  const result: Array<TreeItem> = [];

  function traverse(node: TreeItem) {
    result.push(node);

    if (node.expanded && node.childNodes && node.childNodes.length > 0) {
      node.childNodes.forEach(traverse);
    }
  }

  items.forEach(traverse);
  return result;
}

function updateNodeInTree(
  items: Array<TreeItem>,
  targetValue: string,
  updater: (node: TreeItem) => TreeItem
): Array<TreeItem> {
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
  defaultValue,
  onChange,
}: {
  treeItems: Array<TreeItem>,
  props: InputElement,
  defaultValue?: TreeItem, // TODO: Should also allow for a boolean which sets default to first value if enabled
  onChange?: (value: TreeItem | null) => void
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<TreeItem | null>(defaultValue ?? null)
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [searchValue, setSearchValue] = useState<string>('')

  const [items, setItems] = useState<Array<TreeItem>>(treeItems)
  const [flattenedItems, setFlattenedItems] = useState<Array<TreeItem>>(flattenTree(treeItems))
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

  // Disables form subbmision if value is invalid 
  // Define what an invalid value is (missing value or empty string). We only need this defined if the field is required
  const valueIsValid = useMemo(() => {
    if ((!value || value.value === "") && props.required) return false;
    return true;
  }, [value, props.required]);

  useEffect(() => {
    if (!toggleRef.current) return
    return preventInvalidFormSubmission(toggleRef.current, valueIsValid)
  }, [valueIsValid]);

  useEffect(() => {
    setItems(treeItems);
    setFlattenedItems(flattenTree(treeItems));
  }, [treeItems]);

  const handleUpdateNode = (value: string, updater: (n: TreeItem) => TreeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  async function toggleNode(item: TreeItem) {
    const index = flattenedItems.findIndex(el => el.value === item.value);
    setFocusedIndex(index)
    handleUpdateNode(item.value, node => ({ ...node, loading: true }));
    if (item.onExpand && !item.childNodes) {
      const children = await item.onExpand();
      handleUpdateNode(item.value, node => ({
        ...node,
        childNodes: children,
        expanded: true,
        loading: false,
      }));
    } else {
      handleUpdateNode(item.value, node => ({
        ...node,
        expanded: !node.expanded,
        loading: false,
      }));
    }
  };

  function TreeNode({
    item,
    onUpdate,
    depth = 0
  }: {
    item: TreeItem,
    onUpdate: (value: string, updater: (n: TreeItem) => TreeItem) => void,
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
          onClick={
            item.expanded !== null || item.onExpand !== undefined
              ? () => { void toggleNode(item); searchRef.current?.focus() }
              : () => { setValue(item?.value !== value?.value ? item : null); setMenuOpen(false) }
          }
        >
          {(item.onExpand || (item.childNodes && item.childNodes.length > 0))
            ? <span className="flex gap-25 align-items-center">
              {item.loading ?
                <Image
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
            style={{
              listStyle: 'none',
              borderLeft: '1px dashed var(--gray)',
              marginInlineStart: 'calc(12px + 0.25rem)',
              paddingInlineStart: '.5rem',
              marginBlock: '1px'
            }}
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
        style={{ ...props.style, borderColor: menuOpen ? '#191919' : '' }} // TODO: Not sure style should be set here, do it temporarily to prevent layout shifting in recipevariableeditor for now
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
        aria-required={!!props.required ? props.required : false}
        aria-invalid={!valueIsValid}
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
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id !== props.id) {
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
              if (!toggleRef.current) return;
              handleKeyDownTreeCombobox(
                e,
                focusedIndex,
                setFocusedIndex,
                flattenedItems,
                toggleRef.current,
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
                },
                menuOpen,
                setMenuOpen
              )
            }}
            role="combobox"
            aria-controls={`${props.id}-dialog-tree`}
            // aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            // aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("forms:combobox.default_search_placeholder")}
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