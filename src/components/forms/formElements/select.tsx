"use client"

// TODO: allow passing required
// TODO: Fix bug where menu opens immediately after closing when pressing toggle button

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react"
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" }

export function SelectSingleSearch({
  className,
  style,
  id,
  name,
  initialValue,
  defaultValue,
  required,
  searchBoxLabel,
  searchBoxPlaceholder,
  options,
}: {
  className?: string,
  style?: React.CSSProperties,
  id: string,
  name: string,
  initialValue?: string, // Represents an informative string which must not be submitted by the user
  defaultValue?: string,
  required?: boolean,
  searchBoxLabel: string,
  searchBoxPlaceholder?: string
  options: Array<string>,
}) {
  const { t } = useTranslation(["forms"]);

  const extendedOptions = initialValue
    ? [initialValue, ...options]
    : options;

  const [value, setValue] = useState<string>(defaultValue ? defaultValue : extendedOptions[0]) // TODO: If initialvalue is passed it should be represented as an empty string for the actual value
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  const [valueIsValid, setValueIsValid] = useState<boolean>() // TODO: Export this and use in form validation? Or use the form validation api on the button or something ?

  useEffect(() => {
    if (!value && required || value == initialValue || !extendedOptions.includes(value)) {
      setValueIsValid(false)
    } else {
      setValueIsValid(true)
    }
  }, [value])

  // Fuse search
  const [results, setResults] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState<string>('')

  // Handle search results
  useEffect(() => {
    const fuse = new Fuse(extendedOptions);
    const newResults = searchValue ? fuse.search(searchValue).map(result => result.item) : extendedOptions;
    setResults(newResults);
  }, [searchValue]);

  // Focus and clear search menu when opening the select
  useEffect(() => {
    if (!searchRef.current) return
    searchRef.current.value = ''
    setSearchValue('')
    if (menuOpen) {
      searchRef.current.focus();
    }
  }, [menuOpen]);

  // Sroll listbox element into view
  useEffect(() => {
    if (focusedListBoxItem !== null && optionRefs.current[focusedListBoxItem]) {
      optionRefs.current[focusedListBoxItem]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [focusedListBoxItem]);


  const handleKeyDownSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape out of listbox if it is open
    if (e.key === 'Escape') {
      if (menuOpen) {
        setFocusedListBoxItem(null)
        setMenuOpen(false)
        toggleRef.current?.focus()
      }
    }

    // Selects option and remove listbox (TODO: Check value aswell/lenght of list or whatever...)
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // Prevent higher-level reopens
      if (menuOpen && focusedListBoxItem != null && results.length > 0) {
        setValue(results[focusedListBoxItem])
        setFocusedListBoxItem(null)
        setMenuOpen(false);
        toggleRef.current?.focus()
      }
    }

    // Retain keyboard shortcuts
    if (e.key === 'ArrowDown' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      // If list is open, navigate between items
      if (menuOpen && focusedListBoxItem != null) {
        e.preventDefault()

        if (focusedListBoxItem != results.length - 1) {
          setFocusedListBoxItem(focusedListBoxItem + 1)
        } else {
          setFocusedListBoxItem(0)
        }
      } else { // If list is closed, open it and focus the first element
        setMenuOpen(true)
        setFocusedListBoxItem(0) // TODO: Should move to previous element if one was already selected
      }
    }

    // Retain keyboard shortcuts
    if (e.key === 'ArrowUp' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      // If list is open, navigate between items
      if (menuOpen && focusedListBoxItem != null) {
        e.preventDefault()

        if (focusedListBoxItem != 0) {
          setFocusedListBoxItem(focusedListBoxItem - 1)
        } else {
          setFocusedListBoxItem(results.length - 1)
        }
      } else { // If list is closed, open it and focus the first element
        setMenuOpen(true)
        setFocusedListBoxItem(0) // TODO: Should move to last element, TODO: Should move to previous element if one was already selected
      }
    }

    if (e.key === 'Home') {
      e.preventDefault()
      if (menuOpen) {
        setFocusedListBoxItem(0)
      }
    }

    if (e.key === 'End') {
      e.preventDefault()
      if (menuOpen) {
        setFocusedListBoxItem(results.length - 1)
      }
    }
  };

  return (
    <div
      className={`${className ? `${className} ` : ''}position-relative`}
      style={{ ...style, userSelect: 'none', width: 'fit-content' }}
    >
      <button
        id={id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        value={value}
        name={name}
        ref={toggleRef}
        onClick={() => { setMenuOpen(!menuOpen) }}
        aria-controls={menuOpen ? `${id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        role="combobox"
        type="button"
        aria-required={required ? required : false}
        aria-invalid={!valueIsValid}
      >
        {value}
        <IconSelector height={20} width={20} aria-hidden={true} />
      </button>
      <div // TODO: Does this require a label ?
        id={`${id}-dialog`}
        className={`              
          ${styles['listbox-select']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setFocusedListBoxItem(null)
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"  
      >
        <label
          aria-label="sök..."
          className="focusable flex align-items-center gap-25 padding-block-50 padding-inline-25" style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0', marginBottom: '3px' }}>
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} />
          <input
            ref={searchRef}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDownSearchInput}
            type="text"

            aria-controls={`${id}-dialog-listbox`}
            aria-activedescendant={focusedListBoxItem != null ? `${id}-dialog-listbox-${focusedListBoxItem}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
            aria-label={searchBoxLabel} // TODO: should be the same as placeholder? 
            placeholder={searchBoxPlaceholder ? searchBoxLabel : ''} // TODO: Pass a prop for this maybe? Or atleast i18n
            role="combobox"

            style={{
              padding: '0',
              margin: '0',
              fontSize: 'revert',
              borderRadius: '0' // TODO: Add this to the focusable class instead
            }}
          />
        </label>
        <ul
          role="listbox"
          id={`${id}-dialog-listbox`}
          aria-label={t("forms:suggestive_text.listbox_label")}
          className="margin-0 padding-0"
          style={{
            listStyle: 'none',
          }}>
          {results.length > 0 ? (
            results.map((option, index) => (
              <li
                id={`${id}-dialog-listbox-${index}`}
                onClick={() => {
                  setValue(option),
                  setMenuOpen(false)
                }}
                aria-selected={option === value}
                ref={(el) => { optionRefs.current[index] = el }}
                role="option"
                key={`${index}`} // TODO: Am i allowed to do this or do they need to be unique for entire page?
                style={{
                  backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '',
                }}
              >
                {option}
              </li>
            ))
          ) : (
            <li
              style={{
                userSelect: 'none',
                borderRadius: '.25rem',
                padding: '.5rem',
                fontSize: 'smaller',
                backgroundColor: 'transparent',
                fontWeight: '600'
              }}
            >
              Inga resultat
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}