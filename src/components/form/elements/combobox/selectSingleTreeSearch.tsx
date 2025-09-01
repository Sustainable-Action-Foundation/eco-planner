"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconCaretRightFilled, IconSearch, IconSelect, IconSelector } from "@tabler/icons-react"
import { t } from "i18next"
import { useMemo, useRef, useState } from "react"
import styles from './comboBox.module.css' with { type: "css" }
import { handleKeyDownTreeCombobox } from "./functions"
import Fuse from "fuse.js"

function TreeNode({
  item,
  expandedKeys,
  toggleExpand,
  ref,
  focused,
  id,
}: {
  item: treeItem
  expandedKeys: Set<string>
  toggleExpand: (id: string) => void
  ref?: React.Ref<HTMLLIElement>,
  focused: boolean,
  id: string
}) {

  const isExpanded = expandedKeys.has(item.value)

  return (
    <>
      <li
        id={id}
        role="treeitem"
        ref={ref}
        style={{ paddingInlineStart: item.childNodes.length > 0 ? '0' : 'calc(16px + .25rem)', backgroundColor: focused ? 'var(--gray-90)' : '' }}
        onClick={() => {
          if (item.childNodes.length > 0) {
            toggleExpand(item.value)
          }
        }}
      > {/* TODO: Aria-owns */}
        <span>
          {item.childNodes.length > 0 ?
            <IconCaretRightFilled
              height={16}
              width={16}
              className="margin-right-25"
              style={{ minWidth: '16px', verticalAlign: 'text-bottom', transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
            : null}
          {item.name}
        </span>
      </li>
      {item.childNodes.length > 0 && isExpanded ? (
        <ul role="group" style={{ paddingInlineStart: 'calc(16px + .25rem)' }}>
          {item.childNodes.map((child, index) => (
            <TreeNode
              id={id}
              focused={focused}
              key={index}
              item={child}
              expandedKeys={expandedKeys}
              toggleExpand={toggleExpand}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
}



export default function SelectSingleTreeSearch({
  props,
  treeItems,
  onChange
}: {
  props: inputElement,
  treeItems: Array<treeItem>,
  onChange?: (value: treeItem | null) => void
}) {

  const [value, setValue] = useState<treeItem | null>(null) // TODO: Allow default value

  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [searchValue, setSearchValue] = useState<string>('')
  const [focusedTreeOption, setFocusedTreeOption] = useState<number | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null); // TODO: Rename?
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  
  const searchResults = useMemo(() => {
    const fuse = new Fuse(treeItems, { keys: ['name'] });
    return searchValue
      ? fuse.search(searchValue).map(result => result.item)
      : treeItems;
  }, [searchValue, treeItems]);

  const toggleExpand = (id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none', width: 'fit-content' }}
    >
      <button
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '', width: '300px' }}
        // value={value ? value.value : ''}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          if (e.key == "Escape") {
            setMenuOpen(false)
          }
        }}
        onClick={() => { setMenuOpen(!menuOpen) }}
        role="combobox"
        type="button"
        aria-controls={menuOpen ? `${props.id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-required={props.required ? props.required : false}
      // aria-invalid={!valueIsValid}
      >
        asdsad
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>
      <div
        id={`${props.id}-dialog`}
        className={`              
          ${styles['listbox']} 
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
          <input
            className="margin-0 padding-0"
            type="text"
            role="combobox"
            aria-controls={`${props.id}-dialog-tree`}
            aria-activedescendant={focusedTreeOption != null ? `${props.id}-dialog-listbox-${focusedTreeOption}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("common:tsx.search") + t("common:tsx.ellipsis")}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (!toggleRef.current) return;
              handleKeyDownTreeCombobox(
                e,
                toggleRef.current,
                menuOpen,
                setMenuOpen,
                searchResults,
                focusedTreeOption,
                setFocusedTreeOption,
                setExpandedKeys,
                (selectedOption) => {
                  setValue(selectedOption?.value !== value?.value ? selectedOption : null); // TODO: Abstract this to use in onclick     
                  setMenuOpen(false);
                  toggleRef.current?.focus();
                  if (onChange) onChange(selectedOption?.value !== value?.value ? selectedOption : null);
                }
              )
            }}
          />
        </label>
        <ul
          id={`${props.id}-dialog-tree`}
          className="margin-0 padding-0"
          role="tree"
          aria-label={t("common:tsx.options")}
        >
          {treeItems.length > 0 ? (
            treeItems.map((treeItem, index) => (
              <TreeNode
                id={index.toString()}
                focused={index === focusedTreeOption}
                key={index}
                item={treeItem}
                expandedKeys={expandedKeys}
                toggleExpand={toggleExpand}
                ref={(el) => { optionRefs.current[index] = el }}
              />
            ))
          ) : (
            <li className="no-results font-weight-600">
              No results
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}