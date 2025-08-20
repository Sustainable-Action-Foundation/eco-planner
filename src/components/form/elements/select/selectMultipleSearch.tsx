"use client" 

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState, useRef, useMemo } from "react"
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import styles from '../comboBox.module.css' with { type: "css" }
import { inputElement } from "@/components/types";
import { handleKeyDownEditableCombobox } from "./functions";

export default function SelectMultipleSearch({
  props,
  defaultValue,
  options,
  onChange,
}: {
  props: inputElement,
  defaultValue?: Array<{ name: string, value: string }>,
  options: Array<{ name: string, value: string }>,
  onChange?: (value: Array<{ name: string, value: string }> | null) => void
}) {
  const { t } = useTranslation(["forms"]);
  const [value, setValue] = useState<Array<{ name: string, value: string }>>(
    defaultValue ? defaultValue : []
  )
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const toggleRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [focusedListboxOption, setFocusedListboxOption] = useState<number | null>(null);
  // Fuse searchs
  const [searchValue, setSearchValue] = useState<string>('')

  const searchResults = useMemo(() => {
    const fuse = new Fuse(options, { keys: ['name'] });
    return searchValue
      ? fuse.search(searchValue).map(result => result.item)
      : options;
  }, [searchValue, options]);

  // Disables form subbmision if value is invalid 
  // TODO: Handling required values like this does not work with the fieldset:valid--
  // css pseudo class (our button cannot be valid or required we just pretend it is)
  // Define what an invalid value is (missing value or empty array). We only need this defined if the field is requied
  const valueIsValid = useMemo(() => {
    if ((!value || value.length === 0) && props.required) return false;
    return true;
  }, [value, props.required]);

  useEffect(() => {
    // Stop submission if input is invalid
    const form = toggleRef.current?.closest("form");
    if (!form) return;
    const handleSubmit = (e: Event) => { // TODO: We likely want to abstract this as more inputs may need to check validity
      if (!valueIsValid) {
        e.preventDefault();
        e.stopPropagation();
        toggleRef.current?.focus();
      }
    };
    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [valueIsValid]);

  // 1. Clear search and Focus menu when opening the select
  // 2. remove listboxitem focus
  useEffect(() => { // TODO: We use this in multiple components so might be worth to abstract
    if (!searchRef.current) return
    searchRef.current.value = ''
    setSearchValue('')
    if (menuOpen) {
      searchRef.current.focus();
    }
    setFocusedListboxOption(null)
  }, [menuOpen]);


  // Sroll listbox element into view
  // TODO: We use this in multiple components so might be worth to abstract
  useEffect(() => {
    if (focusedListboxOption !== null && optionRefs.current[focusedListboxOption]) {
      optionRefs.current[focusedListboxOption]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [focusedListboxOption]);

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none', width: 'fit-content' }}
    >
      <button
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        value={value.map((value) => value.value).toString()}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          if (e.key == "Escape") {
            setMenuOpen(false)
          }
        }}
        onClick={() => { setMenuOpen(!menuOpen) }}
        aria-controls={menuOpen ? `${props.id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        role="combobox"
        type="button"
        aria-required={props.required ? props.required : false}
        aria-invalid={!valueIsValid}  // TODO: Fix this (currently disabled for multiselect)
      >
        <span
          style={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: "hidden",
            minWidth: '0',
            color: value.length === 0 ? "gray" : "inherit",
            opacity: props.disabled ? 0.6 : 1,
          }}>
          {value.length > 0
            ? value.map((value) => value.name).toString().slice(0).replaceAll(',', ', ') // TODO: Can probably do this a bit more cleanly
            : props.placeholder
          } {/* TODO: This string manipulation is dangerous if options contain a comma, see what we can do about that */}
        </span>
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>
      <div
        aria-label="" // TODO: Add a label
        id={`${props.id}-dialog`}
        className={`              
          ${styles['listbox-select']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id != props.id) {
            setFocusedListboxOption(null)
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"
      >
        <label
          aria-label="" // TODO: Fix this label
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
              searchResults,
              focusedListboxOption,
              setFocusedListboxOption,
              (selectedOption) => {
                e.stopPropagation(); // Prevent higher-level reopens 
                if (menuOpen && selectedOption) {
                  const optionPreviouslySelected = value.some(value => value.value === selectedOption.value); // TODO: Abstract this to use in onclick   

                  const newValue = optionPreviouslySelected
                    ? value.filter(option => option.value !== selectedOption.value)
                    : [...value, selectedOption];

                  setValue(newValue);

                  if (onChange) onChange(newValue);
                }
              }
            )}
            type="text"

            aria-controls={`${props.id}-dialog-listbox`}
            aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="" // TODO: Fix this placeholder
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
          id={`${props.id}-dialog-listbox`}
          aria-label={t("forms:suggestive_text.listbox_label")}
          aria-multiselectable={true}
          className="margin-0 padding-0"
        >
          {searchResults.length > 0 ? (
            searchResults.map((option, index) => {
              return (
                <li
                  id={`${props.id}-dialog-listbox-${index}`}
                  onClick={() => {
                    const optionPreviouslySelected = value.some(value => value.value === option.value);

                    const newValue = optionPreviouslySelected
                      ? value.filter(value => value.value !== option.value) 
                      : [...value, option];

                    setValue(newValue);

                    if (onChange) onChange(newValue);
                  }}
                  aria-selected={value.some(v => v.value === option.value)} // TODO: Update other select to use this
                  ref={(el) => { optionRefs.current[index] = el }}
                  role="option"
                  key={index}
                  style={{
                    backgroundColor: index === focusedListboxOption ? 'var(--gray-90)' : '',
                  }}
                >
                  {option.name}
                </li>
              )
            })
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