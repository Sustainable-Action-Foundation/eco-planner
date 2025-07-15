"use client"

import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import styles from './searchableList.module.css'
import Fuse from "fuse.js";

export default function Combobox({
  id,
  required,
  placeholder,
  searchableList
}: {
  id: string
  required?: boolean
  placeholder?: string
  searchableList: Array<string>
}) {

  // TODO: Check usage of !searchableList.includes(value)
  // TODO: i18n
  // TODO: Re add button for opening and closing??
  // TODO: Scroll when navigating using keyboard 

  const [value, setValue] = useState<string>('');
  const [renderListBox, setRenderListBox] = useState<boolean>(false)
  const [displayListBox, setDisplayListBox] = useState<boolean>(false)
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null)

  // Fuse search
  const [results, setResults] = useState<string[]>([])

  const handleKeyDownSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape out of listbox if it is open
    // Clear text if listbox is closed
    if (e.key === 'Escape') {
      if (displayListBox) {
        setFocusedListBoxItem(null)
        setDisplayListBox(false)
      } else {
        setValue('')
      }
    }

    // Selects option and remove listbox
    if (e.key === 'Enter') {
      if (displayListBox && focusedListBoxItem != null) {
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
  };

  useEffect(() => {
    const fuse = new Fuse(searchableList);
    const newResults = value ? fuse.search(value).map(result => result.item) : searchableList;
    setResults(newResults);
  }, [value]);

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
      className={`position-relative ${styles['combobox-container']}`} // TODO: Name combobox-container is technically wrong
      style={{ width: 'min(350px, 100%)' }}
    >
      <div className="flex align-items-center focusable">
        <IconSearch aria-hidden="true" className="margin-left-50" width={24} height={24} style={{ minWidth: '24px' }} />
        <input
          required={required ? required : false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDownSearchInput}
          onFocus={() => setDisplayListBox(true)}
          onBlur={() => setDisplayListBox(false)}
          id={id}
          role="combobox"
          type="text"
          placeholder={placeholder ? placeholder : undefined}
          aria-expanded={displayListBox}
          aria-haspopup="listbox"
          aria-controls={displayListBox ? `${id}-listbox` : undefined}
          aria-activedescendant={focusedListBoxItem != null ? `listbox-${focusedListBoxItem}` : undefined}
          aria-autocomplete="list" /* TODO: Might want to implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
          className={`${styles['combobox']}`}
        />
        <IconChevronDown aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} className="margin-right-50" />
      </div>

      <ul
        role="listbox"
        id={`${id}-listbox`}
        aria-label="Aktörer"
        aria-hidden={!displayListBox} // TODO: Check that this works as expected on screenreader
        className={`
            ${!renderListBox ? 'display-none' : 'display-block'}
            ${styles['listbox']} 
            ${displayListBox ? styles['visible'] : ''} 
            margin-inline-0 
            padding-0`
        }
      >
        {results.map((item, index) =>
          <li
            key={index}
            role="option"
            aria-selected={item === value}
            id={`${id}-listbox-${index}`}
            style={{ backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '', }}
            onClick={() => { setValue(item) }}
          >
            {item}
          </li>
        )}
      </ul>
    </div>
  )
}