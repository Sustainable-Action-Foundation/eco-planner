"use client"

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import styles from './searchableList.module.css'

export default function Combobox() {

  // TODO: Handle required inputs
  // TODO: i18n
  
  // TODO: Up arrow should also open listbox
  // TODO: Re add button for opening and closing??

  const testArray: Array<string> = [
    'apple',
    'banana',
    'orange',
    'lemon',
    'kiwi'
  ]

  const [value, setValue] = useState<string>('');
  const [displayListBox, setDisplayListBox] = useState<boolean>(false)
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null)
  const [isFocused, setIsFocused] = useState<boolean>(false); // Ensures that listbox is only visible given that combobox actually retains focus

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

    // Select option and remove listbox
    // TODO: Weird that this opens listbox?
    if (e.key === 'Enter') {
      if (displayListBox && focusedListBoxItem != null) {
        setValue(testArray[focusedListBoxItem])
        setFocusedListBoxItem(null)
        setDisplayListBox(false)
      } else {
        setFocusedListBoxItem(0)
        setDisplayListBox(true)
      }
    }

    if (e.key === 'ArrowDown') {
      if (displayListBox && focusedListBoxItem != null) {

        if (focusedListBoxItem != testArray.length - 1) {
          setFocusedListBoxItem(focusedListBoxItem + 1)
        } else {
          setFocusedListBoxItem(0)
        }

      } else {
        setDisplayListBox(true)
        setFocusedListBoxItem(0)
      }
    }

    // Retain keyboard shortcuts
    // TODO: Retention of keyboard shortcuts same for down arrow?
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      if (displayListBox && focusedListBoxItem != null) {
        e.preventDefault()

        if (focusedListBoxItem != 0) {
          setFocusedListBoxItem(focusedListBoxItem - 1)
        } else {
          setFocusedListBoxItem(testArray.length - 1)
        }
      }
    }
  }; 
   

  return (
    <div className="position-relative" style={{width: 'min(350px, 100%)'}}>
      <label htmlFor="combobox-control">Ange aktör</label>
      <div className="flex align-items-center focusable margin-top-25">
        <IconSearch aria-hidden="true" className="margin-left-50" width={24} height={24} style={{ minWidth: '24px' }} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDownSearchInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          id="combobox-control" /* TODO: Dynamic */
          role="combobox"
          type="text"
          placeholder="Sök.."
          aria-expanded={(displayListBox || (value !== '' && !testArray.includes(value))) && isFocused}
          aria-haspopup="listbox"
          aria-controls={(displayListBox || (value !== '' && !testArray.includes(value))) && isFocused ? "listbox" : undefined} /* TODO: ID Must be dynamic to allow for multiple comboboxes on the same page */
          aria-activedescendant={focusedListBoxItem != null ? `listbox-${focusedListBoxItem}` : undefined}
          aria-autocomplete="list" /* TODO: Might want to implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
        />
        <IconSelector aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} className="margin-right-50" />
      </div>

      <ul
        role="listbox"
        id="listbox" /* TODO: Dynamic */
        aria-label="Aktörer"
        aria-hidden={!(displayListBox || (value !== '' && !testArray.includes(value))) && isFocused} // TODO: Check that this works as expected
        className={`${styles['listbox']} margin-inline-0 padding-0`}
        /* Setting styling insead of conditionally rendering allows us to animate using css transitions */
        style={{    
          pointerEvents: (displayListBox || (value !== '' && !testArray.includes(value))) && isFocused ? 'auto' : 'none',
          opacity: (displayListBox || (value !== '' && !testArray.includes(value))) && isFocused ? 1 : 0,
          transform: (displayListBox || (value !== '' && !testArray.includes(value))) && isFocused ? 'scale(1)' : 'scale(0.95)'
        }}
      >
        {testArray.map((item, index) =>
          <li
            key={index}
            role="option"
            aria-selected={item === value}
            id={`listbox-${index}`}
            style={{backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '', }}
            onClick={() => {setValue(item), setDisplayListBox(false)}}
          >
            {item}
          </li>
        )}
      </ul>
    </div>
  )
}