"use client"

import { inputElement, treeItem } from "@/components/types"
import { IconSearch } from "@tabler/icons-react"
import { t } from "i18next"
import { useState } from "react"
import styles from './comboBox.module.css' with { type: "css" }

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

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none', width: 'fit-content' }}
    >
      <button
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
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
          <input type="text" role="combobox" />
        </label>
        <ul role="tree" className="padding-0">
          {treeItems.length > 0 ? (
            treeItems.map((treeItem: treeItem, index: number) => (
              <li role="treeitem" style={{display: 'block'}} key={index}>
                <div>{treeItem.name}</div>
                {treeItem.childNodes.length > 0 ? (
                  <ul role="group">
                    {treeItem.childNodes.map((childNode: treeItem) => (
                      <li>{childNode.name}</li>
                    ))}
                  </ul> 
                ) : null }  
              </li>
            ))
          ) : (
            <li className={`${styles['no-results']} font-weight-600`} >
              {t("common:tsx.no_results")}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}