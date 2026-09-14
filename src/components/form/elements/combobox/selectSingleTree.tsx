"use client";

import type { InputElement, TreeItem } from "@/components/types";
import { IconCaretRightFilled, IconSelector } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { handleKeyDownTreeCombobox, scrollOptionIntoView } from "./functions";
import { ComboboxValidationProxy } from "./validationProxy";
import styles from './comboBox.module.css' with { type: "css" };
import { useTranslation } from "react-i18next";
import Image from "next/image";

// TODO: Aria-setsize (How do we deal with this given async functions)
// TODO: Aria-posinset (How do we deal with this given async functions)
// TODO: Should allow for options with same values? Or we should check that they are unique?
// TODO: We should look into keeping state, i.e opening and selecting the thing you had already selected before closing (maybe if it is not annoying...)

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
  updater: (node: TreeItem) => TreeItem,
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

/**
 * Lives at module level on purpose: declaring it inside `SelectSingleTree` made it a new
 * component type on every render, so React remounted every tree node whenever the parent
 * re-rendered (e.g. a recipe evaluation finishing). A remount between mousedown and mouseup
 * swallows the click, which made expanding nodes flaky in e2e tests.
 */
function TreeNode({
  item,
  depth = 0,
  flattenedItems,
  selectedValue,
  treeItemsRef,
  onToggle,
  onSelect,
}: {
  item: TreeItem,
  depth?: number,
  flattenedItems: Array<TreeItem>,
  selectedValue: string | undefined,
  treeItemsRef: React.RefObject<(HTMLLIElement | null)[]>,
  onToggle: (item: TreeItem) => void,
  onSelect: (item: TreeItem) => void,
}) {
  const index = flattenedItems.findIndex(i => i.value === item.value);
  const expandable = item.expanded !== null || item.onExpand !== undefined;

  return (
    <li
      role="treeitem"
      id={`${item.value}`}
      ref={(el) => { treeItemsRef.current[index] = el; }}
      aria-level={depth + 1}
      aria-selected={(item.expanded === null || item.onExpand === undefined) && item.value === selectedValue}
      aria-expanded={expandable ? !!item.expanded : undefined}
    >
      <div
        className={`flex gap-25 align-items-center justify-content-space-between`}
        onClick={() => expandable ? onToggle(item) : onSelect(item)}
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
      {item.expanded && item.childNodes ? <ul
        role="group"
        style={{
          listStyle: 'none',
          borderLeft: '1px dashed var(--gray)',
          marginInlineStart: 'calc(12px + 0.25rem)',
          paddingInlineStart: '.5rem',
          marginBlock: '1px',
        }}
        className="margin-0 padding-inline-start-75"
      >
        {item.childNodes.map((child, index) => (
          <TreeNode
            key={index}
            item={child}
            depth={depth + 1}
            flattenedItems={flattenedItems}
            selectedValue={selectedValue}
            treeItemsRef={treeItemsRef}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
      </ul> : null}
    </li>
  );
}

/**
 * `next` with the expansion state (`expanded`, `loading`, fetched `childNodes`)
 * of matching nodes in `prev` carried over, so a re-render of the caller with
 * a fresh `treeItems` array doesn't collapse what the user has opened.
 */
function withExpansionState(next: TreeItem[], prev: TreeItem[]): TreeItem[] {
  const previous = new Map(prev.map(item => [item.value, item]));
  return next.map(item => {
    const old = previous.get(item.value);
    if (!old) return item;
    const childNodes = item.childNodes ?? old.childNodes;
    return {
      ...item,
      expanded: old.expanded ?? item.expanded,
      loading: old.loading,
      childNodes: childNodes && old.childNodes ? withExpansionState(childNodes, old.childNodes) : childNodes,
    };
  });
}

export default function SelectSingleTree({
  treeItems,
  props,
  defaultValue,
  onChange,
  loading = false,
}: {
  treeItems: TreeItem[];
  props: InputElement;
  defaultValue?: TreeItem; // TODO: Should also allow for a boolean which sets default to first value if enabled
  onChange?: (value: TreeItem | null) => void
  /** The items are still being fetched: shows a loading row instead of "no results" */
  loading?: boolean;
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<TreeItem | null>(defaultValue ?? null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const [items, setItems] = useState<Array<TreeItem>>(treeItems);
  const [flattenedItems, setFlattenedItems] = useState<Array<TreeItem>>(flattenTree(treeItems));
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const treeItemsRef = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (!onChange) return;
    onChange(value);
  }, [value, onChange]);

  useEffect(() => {
    if (items.length === 0) return;
    setFlattenedItems(flattenTree(items));
  }, [items]);

  useEffect(() => {
    if (focusedIndex == null || flattenedItems.length === 0) return;
    const selectedItem = flattenedItems[focusedIndex];
    const selectedItemElement = document.getElementById(`${selectedItem.value}`);

    if (!selectedItemElement) return;

    const selectedItemElementText = selectedItemElement.querySelector<HTMLDivElement>(':scope > div');
    if (!selectedItemElementText) return;

    selectedItemElementText.style.backgroundColor = "var(--gray-90)"; // TODO: See if we can replace this using the focused-option class

  }, [focusedIndex, flattenedItems, props.id]);

  // Define what an invalid value is (missing value or empty string). We only need this defined if the field is required
  const valueIsValid = useMemo(() => {
    if ((!value || value.value === "") && props.required) return false;
    return true;
  }, [value, props.required]);

  // New items from the caller keep whatever the user has expanded (see withExpansionState)
  useEffect(() => {
    setItems(prev => withExpansionState(treeItems, prev));
  }, [treeItems]);

  useEffect(() => {
    // Very janky, ideally want to get just "nearest to function as intended..."
    scrollOptionIntoView(
      treeItemsRef.current,
      focusedIndex, 
      focusedIndex === 0 ? "start" : "nearest",
  ); }, [focusedIndex]);

  const handleUpdateNode = (value: string, updater: (n: TreeItem) => TreeItem) => {
    setItems(prev => updateNodeInTree(prev, value, updater));
  };

  async function toggleNode(item: TreeItem) {
    const index = flattenedItems.findIndex(el => el.value === item.value);
    setFocusedIndex(index);
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

  function handleNodeToggle(item: TreeItem) {
    void toggleNode(item);
    toggleRef.current?.focus();
  }

  function handleNodeSelect(item: TreeItem) {
    setValue(item.value !== value?.value ? item : null);
    setMenuOpen(false);
  }

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none' }}
    >
      <button
        title={value?.name}
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ ...props.style, borderColor: menuOpen ? '#191919' : '' }}
        value={value ? value.value : ''}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef}
        onClick={() => { setMenuOpen(!menuOpen); }}
        role="combobox"
        type="button"
        aria-controls={menuOpen ? `${props.id}-dialog-tree` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-required={props.required ? props.required : false}
        aria-invalid={!valueIsValid}
        aria-activedescendant={focusedIndex ? flattenedItems[focusedIndex].value : undefined}
        onBlur={(e) => {
          if (e.relatedTarget?.id !== `${props.id}-dialog-tree` && e.relatedTarget?.id !== props.id) {
            setFocusedIndex(null);
            setMenuOpen(false);
          }
        }}

        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
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
              if (!selectedTreeItem) return;
              // If the node can be expanded and if it has an onExpand function, we toggle the node,
              if (selectedTreeItem.expanded !== null || selectedTreeItem.onExpand !== undefined) {
                void toggleNode(selectedTreeItem);
              } else {
                setValue(selectedTreeItem?.value !== value?.value ? selectedTreeItem : null);
                setMenuOpen(false);
              }
            },
            menuOpen,
            setMenuOpen,
          );
        }}
      >
        <span className={`${styles['selected-value-text']}`}>
          {!value ? props.placeholder : value.name}
        </span>
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>
      <ComboboxValidationProxy
        hasValue={!!value && value.value !== ""}
        required={props.required}
        disabled={props.disabled}
        form={props.form}
      />

      <ul
        id={`${props.id}-dialog-tree`}
        tabIndex={-1}
        style={{scrollPadding: '45%'}}
        className={`              
            ${styles['tree']} 
            ${menuOpen ? styles['visible'] : ''} 
            padding-0
            margin-inline-0
          `}
        role="tree"
        aria-label={t("forms:combobox.select_single_option")}
      >
        {items.length > 0 ? (
          items.map((treeItem, index) => (
            <TreeNode
              key={index}
              item={treeItem}
              flattenedItems={flattenedItems}
              selectedValue={value?.value}
              treeItemsRef={treeItemsRef}
              onToggle={handleNodeToggle}
              onSelect={handleNodeSelect}
            />
          ))
        ) : loading ? (
          // Not a tree item (role-wise), so it can't be mistaken for one while the items load
          <li role="presentation" className={`${styles['no-results']} flex gap-25 align-items-center`} style={{ padding: '.5rem' }} aria-live="polite">
            <Image src='/loaders/ring-resize.svg' alt="" width={16} height={16} />
            {t("forms:combobox.loading")}
          </li>
        ) : (
          <li role="presentation" className={`${styles['no-results']} font-weight-600`} style={{ padding: '.5rem' }}> {/* TODO: For whatever reason i need to set padding here but not for the selectsingleserach no results <li>. They are seemingly implemented the same way so probably figure out why this is. */}
            {t("common:tsx.no_results")}
          </li>
        )}
      </ul>
    </div>
  );
}