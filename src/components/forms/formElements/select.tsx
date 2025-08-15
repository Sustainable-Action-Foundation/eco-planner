"use client"

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react"
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" }

// TODO: TAB should accept currently focused value

export function SelectSingleSearch({
  className,
  style,
  id,
  name,
  defaultValue,
  required,
  placeholder,
  searchBoxLabel,
  searchBoxPlaceholder,
  options,
}: {
  className?: string,
  style?: React.CSSProperties,
  id: string,
  name: string,
  defaultValue?: { name: string, value: string } | boolean,
  required?: boolean,
  placeholder?: string,
  searchBoxLabel: string,
  searchBoxPlaceholder?: string
  options: Array<{ name: string, value: string }>,
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<{ name: string, value: string }>(
    typeof defaultValue === "object" && defaultValue !== null
      ? defaultValue
      : defaultValue === true
        ? options[0]
        : { name: "", value: "" }
  ) // TODO: Update this name
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  const [valueIsValid, setValueIsValid] = useState<boolean>()

  useEffect(() => {
    if (value.value == "" && required) {
      setValueIsValid(false)
    } else {
      setValueIsValid(true)
    }
  }, [value])

  // Disables form subbmision if value is invalid 
  // TODO: Handling required values like this does not work with the fieldset:valid--
  // css pseudo class (our button cannot be valid or required we just pretend it is)
  useEffect(() => {
    // Find the closest form element up the DOM tree
    const form = toggleRef.current?.closest("form");
    if (!form) return;

    const handleSubmit = (e: Event) => {
      if (required && value.value === "") {
        e.preventDefault(); // Stop submission
        e.stopPropagation();
        // You can also set a visual indicator for invalid state here
        setValueIsValid(false);
        toggleRef.current?.focus();
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [required, value]);

  // Fuse search
  const [results, setResults] = useState<Array<{ name: string, value: string }>>([])
  const [searchValue, setSearchValue] = useState<string>('')

  // Handle search results
  useEffect(() => {
    const fuse = new Fuse(options, {
      keys: ['name']
    });
    const newResults = searchValue ? fuse.search(searchValue).map(result => result.item) : options;
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
        setValue(results[focusedListBoxItem] !== value ? results[focusedListBoxItem] : { name: "", value: "" }),
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
        value={value.value}
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
        {options.includes(value) ? value.name : placeholder}
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
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id != id) {
            setFocusedListBoxItem(null)
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"
      >
        <label
          aria-label={searchBoxLabel}
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
            placeholder={searchBoxPlaceholder ? searchBoxLabel : ''}
            role="combobox"

            style={{
              padding: '0',
              margin: '0',
              fontSize: 'revert',
            }}
          />
        </label>
        <ul
          role="listbox"
          id={`${id}-dialog-listbox`}
          aria-label={t("forms:suggestive_text.listbox_label")}
          className="margin-0 padding-0"
        >
          {results.length > 0 ? (
            results.map((option, index) => (
              <li
                id={`${id}-dialog-listbox-${index}`}
                onClick={() => {
                  setValue(option !== value ? option : { name: "", value: "" }),
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
                {option.name}
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

export function SelectMultipleSearch({
  className,
  style,
  id,
  name,
  defaultValue,
  required,
  placeholder,
  searchBoxLabel,
  searchBoxPlaceholder,
  options,
}: {
  className?: string,
  style?: React.CSSProperties,
  id: string,
  name: string,
  defaultValue?: Array<{ name: string, value: string }>,
  required?: boolean,
  placeholder?: string,
  searchBoxLabel: string,
  searchBoxPlaceholder?: string
  options: Array<{ name: string, value: string }>,
}) {
  const { t } = useTranslation(["forms"]);
  const [value, setValue] = useState<Array<{ name: string, value: string }>>(
    defaultValue ? defaultValue : []
  ) // TODO: Update this name
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  const [valueIsValid, setValueIsValid] = useState<boolean>()

  {/*
  useEffect(() => {
    if (value.value == "" && required) {
      setValueIsValid(false)
    } else {
      setValueIsValid(true)
    }
  }, [value])

  // Disables form subbmision if value is invalid 
  // TODO: Handling required values like this does not work with the fieldset:valid--
  // css pseudo class (our button cannot be valid or required we just pretend it is)
  useEffect(() => {
    // Find the closest form element up the DOM tree
    const form = toggleRef.current?.closest("form");
    if (!form) return;

    const handleSubmit = (e: Event) => {
      if (required && value.value === "") {
        e.preventDefault(); // Stop submission
        e.stopPropagation();
        // You can also set a visual indicator for invalid state here
        setValueIsValid(false);
        toggleRef.current?.focus();
      }
    };

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [required, value]);
  */}
  // Fuse search
  const [results, setResults] = useState<Array<{ name: string, value: string }>>([])
  const [searchValue, setSearchValue] = useState<string>('')

  // Handle search results
  useEffect(() => {
    const fuse = new Fuse(options, {
      keys: ['name']
    });
    const newResults = searchValue ? fuse.search(searchValue).map(result => result.item) : options;
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
        setValue([...value, results[focusedListBoxItem]])
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
        value={value.map((value) => value.value).toString()} // TODO: Why is this "false" ?
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
        <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: "hidden", minWidth: '0' }}>
          {value.length > 0 ? value.map((value) => value.name).toString().slice(0).replaceAll(',', ', '): placeholder} {/* TODO: This string manipulation is dangerous if options contain a comma, see what we can do about that */}
          </span>
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>
      <div // TODO: Does this require a label ?
        id={`${id}-dialog`}
        className={`              
          ${styles['listbox-select']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id != id) {
            setFocusedListBoxItem(null)
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"
      >
        <label
          aria-label={searchBoxLabel}
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
            placeholder={searchBoxPlaceholder ? searchBoxLabel : ''}
            role="combobox"

            style={{
              padding: '0',
              margin: '0',
              fontSize: 'revert',
            }}
          />
        </label>
        <ul
          role="listbox"
          id={`${id}-dialog-listbox`}
          aria-label={t("forms:suggestive_text.listbox_label")}
          className="margin-0 padding-0"
        >
          {results.length > 0 ? (
            results.map((option, index) => (
              <li
                id={`${id}-dialog-listbox-${index}`}
                onClick={() => {
                  setValue(prev =>
                    prev.some(v => v.value === option.value) // check by a unique property
                      ? prev.filter(v => v.value !== option.value) // remove if already present
                      : [...prev, option] // add if not present
                  );
                }}
                aria-selected={value.includes(option)}
                ref={(el) => { optionRefs.current[index] = el }}
                role="option"
                key={`${index}`} // TODO: Am i allowed to do this or do they need to be unique for entire page?
                style={{
                  backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '',
                }}
              >
                {option.name}
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