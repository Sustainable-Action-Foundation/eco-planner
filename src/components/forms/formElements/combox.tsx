"use client"

import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
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
  // TODO: Is it sensible to only show menu when we have a value? It probably makes more sense to
  // display it on focus with the option to hide it using the escape key, and toggle ON display using arrow keys?

  const [value, setValue] = useState<string>('');
  const [displayListBox, setDisplayListBox] = useState<boolean>(false)
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null)
  const [isFocused, setIsFocused] = useState<boolean>(false); // Ensures that listbox is only visible given that combobox actually retains focus
  
  // Fuse search
  const [results, setResults] = useState<string[]>([])

  const handleKeyDownSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape out of listbox if it is open
    // Clear text if listbox is closed
    if (e.key === 'Escape') {
      if (displayListBox && focusedListBoxItem != null) {
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
        setDisplayListBox(false)
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
      } else { // If list is closed, open it
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
      } else { // If list is closed, open it
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
 
  return (
    <div className="position-relative" style={{width: 'min(350px, 100%)'}}>
      <div className="flex align-items-center focusable">
        <IconSearch aria-hidden="true" className="margin-left-50" width={24} height={24} style={{ minWidth: '24px' }} />
        <input
          required={required ? required : false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDownSearchInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          id={id}  
          role="combobox"
          type="text"
          placeholder={placeholder ? placeholder : undefined}
          aria-expanded={(displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused}
          aria-haspopup="listbox"
          aria-controls={(displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused ? `${id}-listbox` : undefined} 
          aria-activedescendant={focusedListBoxItem != null ? `listbox-${focusedListBoxItem}` : undefined}
          aria-autocomplete="list" /* TODO: Might want to implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
        />
        <IconChevronDown aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} className="margin-right-50" />
      </div>

      <ul
      /* This steals focus, should it? */
        role="listbox"
        id={`${id}-listbox`} 
        aria-label="Aktörer"
        aria-hidden={!(displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused} // TODO: Check that this works as expected on screenreader
        className={`${styles['listbox']} margin-inline-0 padding-0`}
        /* Setting styling instead of conditionally rendering allows us to animate using css transitions */
        style={{    
          pointerEvents: (displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused ? 'auto' : 'none',
          opacity: (displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused ? 1 : 0,
          transform: (displayListBox || (value !== '' && !searchableList.includes(value))) && isFocused ? 'scale(1)' : 'scale(0.95)'
        }}
      >
        {results.map((item, index) =>
          <li
            key={index}
            role="option"
            aria-selected={item === value}
            id={`${id}-listbox-${index}`}
            style={{backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '', }}
            onClick={() => {setValue(item), setDisplayListBox(false)}} /* TODO: Pointer events make this buggy */
          >
            {item}
          </li>
        )}
      </ul>
    </div>
  )
}