"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconCaretDownFilled, IconCaretRightFilled, IconSearch } from "@tabler/icons-react"
import { t } from "i18next"
import { useState } from "react"
import styles from './comboBox.module.css' with { type: "css" }


function TreeNode({
  item,
  expandedKeys,
  toggleExpand,
}: {
  item: treeItem
  expandedKeys: Set<string>
  toggleExpand: (id: string) => void
}) {
  const isExpanded = expandedKeys.has(item.value)

  return (
    <>
      <li role="treeitem"
        style={{ paddingInlineStart: item.childNodes.length > 0 ? '0' : 'calc(16px + .25rem)' }}
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

  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

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
        // ref={toggleRef}
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
            type="text"
            role="combobox"
            aria-controls={`${props.id}-dialog-tree`}
            // aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
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
          {treeItems.length > 0 ? (
            treeItems.map((treeItem, index) => (
              <TreeNode
                key={index}
                item={treeItem}
                expandedKeys={expandedKeys}
                toggleExpand={toggleExpand}
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