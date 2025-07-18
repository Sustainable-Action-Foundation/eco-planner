"use client"

import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import styles from './comboBox.module.css' with { type: "css" }
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";

export default function SuggestiveText({
  id,
  name,
  className,
  style,
  required,
  placeholder,
  defaultValue,
  suggestiveList,
}: {
  id: string
  name: string,
  className?: string,
  style?: React.CSSProperties,
  required?: boolean
  placeholder?: string
  defaultValue?: string
  suggestiveList: Array<string>
}) {

  // TODO input_updates: Fallback for no JS

  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<string>(defaultValue ? defaultValue : '');
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  // We only need this to ensure animations play. 
  // We set displayListBox to transition from opacity: 1 -> 0
  // Then renderListBox after 150ms (duration of transition) to set display: block -> none
  const [renderListBox, setRenderListBox] = useState<boolean>(false);
  const [displayListBox, setDisplayListBox] = useState<boolean>(false);

  // Fuse search
  const [results, setResults] = useState<string[]>([])

  // Refs
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const comboboxRef = useRef<HTMLInputElement>(null);

  const handleKeyDownSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape out of listbox if it is open
    if (e.key === 'Escape') {
      if (displayListBox) {
        setFocusedListBoxItem(null)
        setDisplayListBox(false)
      }
    }

    // Selects option and remove listbox (TODO: Check value aswell/lenght of list or whatever...)
    if (e.key === 'Enter') {
      if (displayListBox && focusedListBoxItem != null && results.length > 0) {
        setValue(results[focusedListBoxItem])
        setFocusedListBoxItem(null)
        setDisplayListBox(false);
      }
    }

    // Retain keyboard shortcuts
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      // If list is open, navigate between items
      if (displayListBox && focusedListBoxItem != null) {
        e.preventDefault()

        if (focusedListBoxItem != results.length - 1) {
          setFocusedListBoxItem(focusedListBoxItem + 1)
        } else {
          setFocusedListBoxItem(0)
        }
      } else { // If list is closed, open it and focus the first element
        setDisplayListBox(true)
        setFocusedListBoxItem(0)
      }
    }

    // Retain keyboard shortcuts
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      // If list is open, navigate between items
      if (displayListBox && focusedListBoxItem != null) {
        e.preventDefault()

        if (focusedListBoxItem != 0) {
          setFocusedListBoxItem(focusedListBoxItem - 1)
        } else {
          setFocusedListBoxItem(results.length - 1)
        }
      } else { // If list is closed, open it and focus the first element
        setDisplayListBox(true)
        setFocusedListBoxItem(0)
      }
    }

    if (e.key === 'Home') {
      if (displayListBox) {
        setFocusedListBoxItem(0)
      }
    }

    if (e.key === 'End') {
      if (displayListBox) {
        setFocusedListBoxItem(results.length - 1)
      }
    }

  };

  // Handle search results
  useEffect(() => {
    const fuse = new Fuse(suggestiveList);
    const newResults = value ? fuse.search(value).map(result => result.item) : suggestiveList;
    setResults(newResults);
  }, [value]);

  // Sroll listbox element into view
  useEffect(() => {
    if (focusedListBoxItem !== null && optionRefs.current[focusedListBoxItem]) {
      optionRefs.current[focusedListBoxItem]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [focusedListBoxItem]);

  // Ensure animations are synced 
  useEffect(() => {
    if (displayListBox) {
      setRenderListBox(true)
    } else {
      setTimeout(() => {
        setRenderListBox(false);
      }, 150)
    }
  }, [displayListBox]);

  return (
    <div
      className={`${className ? `${className} ` : ''}position-relative`}
      style={{ ...style }}
    >
      <div className="flex align-items-center focusable">
        <input
          type="text"
          placeholder={placeholder ? placeholder : undefined}
          name={name}
          id={id}
          required={required ? required : false}
          value={value}
          ref={comboboxRef}
          onChange={(e) => { setValue(e.target.value), setFocusedListBoxItem(0), optionRefs.current[0]?.scrollIntoView({ block: "nearest" }) }}
          onKeyDown={handleKeyDownSearchInput}
          onFocus={() => setDisplayListBox(true)}
          onBlur={(e) => { if (e.relatedTarget?.id != `${id}-listbox` && e.relatedTarget?.id != `${id}-button`) { setDisplayListBox(false) } }}
          role="combobox"
          aria-expanded={displayListBox}
          aria-haspopup="listbox"
          aria-controls={displayListBox ? `${id}-listbox` : undefined}
          aria-activedescendant={focusedListBoxItem != null ? `${id}-listbox-${focusedListBoxItem}` : undefined}
          aria-autocomplete="list" /* TODO input_updates: Implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
        />
        {suggestiveList.length > 0 ?
          <button
            id={`${id}-button`}
            className="round grid margin-right-25 transparent"
            style={{ padding: '2px' }}
            onClick={() => { comboboxRef.current?.focus(), setDisplayListBox(!displayListBox) }}
            type="button"
            tabIndex={-1}
            aria-pressed={displayListBox}
            aria-label={t("forms:suggestive_text.toggle_button")}
          >
            <IconChevronDown aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} />
          </button>
          : null}
      </div>

      {suggestiveList.length > 0 ?
        <ul
          id={`${id}-listbox`}
          className={`
              ${!renderListBox ? 'display-none' : 'display-block'}
              ${styles['listbox']} 
              ${displayListBox ? styles['visible'] : ''} 
              margin-inline-0`
          }
          onBlur={(e) => { if (e.relatedTarget?.id != id) { setDisplayListBox(false) } }}
          role="listbox"
          tabIndex={-1}
          aria-label={t("forms:suggestive_text.listbox_label")}
          data-listbox-label={results.length > 0 ? `${t("forms:suggestive_text.listbox_label")}` : `${t("forms:suggestive_text.listbox_empty_label")}`} // TODO: I18n
        >
          {results.map((item, index) =>
            <li
              key={index}
              id={`${id}-listbox-${index}`}
              style={{ backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '', }}
              ref={(el) => { optionRefs.current[index] = el }}
              onClick={() => { setValue(item), setDisplayListBox(false) }}
              role="option"
              aria-selected={item === value}
            >
              {item}
            </li>
          )}
        </ul>
        : null}
    </div>
  )
}