"use client"

// TODO: Fix issues with tab.

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react"
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import styles from '../comboBox.module.css' with { type: "css" }
import { handleKeyDownEditableCombobox } from "./functions";

export default function SelectSingleSearch({
  className,
  style,
  id,
  name,
  defaultValue,
  required,
  disabled,
  placeholder,
  searchBoxLabel,
  searchBoxPlaceholder,
  options,
  onChange,
}: {
  className?: string,
  style?: React.CSSProperties,
  id: string,
  name: string,
  defaultValue?: { name: string, value: string } | boolean,
  required?: boolean,
  disabled?: boolean,
  placeholder?: string,
  searchBoxLabel: string,
  searchBoxPlaceholder?: string
  options: Array<{ name: string, value: string }>,
  onChange?: (value: { name: string, value: string } | null) => void // TODO: Need this for multiselect also, TODO: Check that this syntax is correct
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<{ name: string, value: string } | null>(
    typeof defaultValue === "object" && defaultValue !== null
      ? defaultValue
      : defaultValue === true
        ? options[0]
        : null
  ) // TODO: Update this name
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  const [valueIsValid, setValueIsValid] = useState<boolean>()

  useEffect(() => {
    if ((!value || value.value == "") && required) {
      setValueIsValid(false)
    } else {
      setValueIsValid(true)
    }

    if (onChange) {
      onChange(value)
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
      if ((!value || value.value == "") && required) {
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

  return (
    <div
      className={`${className ? `${className} ` : ''}position-relative`}
      style={{ ...style, userSelect: 'none', width: 'fit-content' }}
    >
      <button
        id={id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        value={value ? value.value : ''}
        name={name}
        disabled={disabled}
        ref={toggleRef}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          if (e.key == "Escape") {
            setMenuOpen(false)
          }
          /* TODO: Should i do this?
          if (e.key == "Enter" || e.key == " ") {
            setFocusedListBoxItem(0)
          } */
        }}
        onClick={() => { setMenuOpen(!menuOpen) }}
        aria-controls={menuOpen ? `${id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        role="combobox"
        type="button"
        aria-required={required ? required : false}
        aria-invalid={!valueIsValid}
      >
        <span
          style={{
            color: value && options.some(o => o.value === value.value) ? "inherit" : "gray",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {value && options.some(o => o.value === value.value) ? value.name : placeholder}
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
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownEditableCombobox(
              e,
              toggleRef.current!,
              menuOpen,
              setMenuOpen,
              results,
              focusedListBoxItem,
              setFocusedListBoxItem,
              (selectedOption, index) => console.log(selectedOption, index)
            )}
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
                  setValue(option.value !== value?.value ? option : null),
                    setMenuOpen(false)
                }}
                aria-selected={option.value === value?.value}
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