"use client" 

import { useEffect, useState, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" }
import { inputElement } from "@/components/types";
import { clearEditableCombobox, handleKeyDownEditableCombobox, preventInvalidFormSubmission, scrollOptionIntoView } from "./functions";
import Fuse from "fuse.js";
import { IconSearch, IconSelector } from "@tabler/icons-react";

// TODO: Should allow for options with same values? Or we should check that they are unique?
// TODO: Disallow an empty array for options?
// TODO: Give aria-keyocontrols?

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
  const [focusedListboxOption, setFocusedListboxOption] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState<string>('')
  const toggleRef = useRef<HTMLButtonElement>(null); // TODO: Rename?
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const searchResults = useMemo(() => {
    const fuse = new Fuse(options, { keys: ['name'] });
    return searchValue
      ? fuse.search(searchValue).map(result => result.item)
      : options;
  }, [searchValue, options]);

  // TODO: Handling required values like this does not work with the fieldset:valid--
  // css pseudo class (our button cannot be valid or required we just pretend it is)
  // Disables form subbmision if value is invalid 
  // Define what an invalid value is (missing value or empty array). We only need this defined if the field is requied
  const valueIsValid = useMemo(() => {
    if ((!value || value.length === 0) && props.required) return false;
    return true;
  }, [value, props.required]);
 
  useEffect(() => {
    if (!toggleRef.current) return
    return preventInvalidFormSubmission(toggleRef.current, valueIsValid)
  }, [valueIsValid]);
 
  useEffect(() => { 
    if (!searchRef.current) return
    clearEditableCombobox(
      searchRef.current,
      setSearchValue,
      menuOpen,
      setFocusedListboxOption
    ) 
  }, [menuOpen]);

  useEffect(() => {
    scrollOptionIntoView(optionRefs.current, focusedListboxOption)
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
        aria-invalid={!valueIsValid} 
      >
        <span
          style={{
            // TODO: Make into a class?
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: "hidden",
            minWidth: '0',
            color: value.length === 0 ? "gray" : "inherit",
            opacity: props.disabled ? 0.6 : 1,
          }}>
          {value.length > 0
            ? value.map((value) => value.name).join(", ")
            : props.placeholder
          }
        </span>
        <IconSelector height={20} width={20} style={{ minWidth: '20px' }} aria-hidden={true} />
      </button>
      <div
        id={`${props.id}-dialog`}
        className={`              
          ${styles['listbox']} 
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
        aria-label="Välj ett alternativ" // TODO: i18n
      >
        <label
          aria-label="Sök..." // TODO: i18n
          className="focusable flex align-items-center gap-25 padding-block-50 padding-inline-25" style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0', marginBottom: '3px' }}>
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} />
          <input
            ref={searchRef}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (!toggleRef.current) return; 
              handleKeyDownEditableCombobox(
              e,
              toggleRef.current,
              menuOpen,
              setMenuOpen,
              searchResults,
              focusedListboxOption,
              setFocusedListboxOption,
              (selectedOption) => {
                e.stopPropagation(); 
                if (menuOpen && selectedOption) {
                  const optionPreviouslySelected = value.some(value => value.value === selectedOption.value); // TODO: Abstract this to use in onclick   

                  const newValue = optionPreviouslySelected
                    ? value.filter(option => option.value !== selectedOption.value)
                    : [...value, selectedOption];

                  setValue(newValue);

                  if (onChange) onChange(newValue);
                }
              }
            )}}
            type="text"
            aria-controls={`${props.id}-dialog-listbox`}
            aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder="Sök..."  
            role="combobox"
            style={{ padding: '0', margin: '0', fontSize: 'revert' }}
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
                    searchRef.current?.focus() // TODO: Might be a more clean way to do this
                  }}
                  aria-selected={value.some(value => value.value === option.value)}  
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
            <li className={`${styles['no-results']} font-weight-600`} >
              Inga resultat {/* TODO: I18n */}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}