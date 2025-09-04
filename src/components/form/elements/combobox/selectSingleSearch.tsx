"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" }
import { inputElement, option } from "@/components/types";
import { clearEditableCombobox, handleKeyDownEditableCombobox, preventInvalidFormSubmission, scrollOptionIntoView } from "./functions";
import Fuse from "fuse.js";
import { IconSearch, IconSelector } from "@tabler/icons-react";

// TODO: Should allow for options with same values? Or we should check that they are unique?
// TODO: Disallow an empty array for options?
// TODO: Give aria-keyocontrols?
// TODO: should just pass the types, not props.

export default function SelectSingleSearch({
  props,
  defaultValue,
  options,
  onChange,
}: {
  props: inputElement,
  defaultValue?: option | boolean,
  options: Array<option>,
  onChange?: (value: option | null) => void 
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<option | null>(
    typeof defaultValue === "object" && defaultValue !== null
      ? defaultValue
      : defaultValue === true
        ? options[0]
        : null
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
  // Define what an invalid value is (missing value or empty string). We only need this defined if the field is requied
  const valueIsValid = useMemo(() => {
    if ((!value || value.value === "") && props.required) return false;
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
        value={value ? value.value : ''}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef} 
        onClick={() => { setMenuOpen(!menuOpen) }}
        role="combobox"
        type="button"
        aria-controls={menuOpen ? `${props.id}-dialog` : undefined}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
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
            color: !value ? "gray" :  "inherit",
            opacity: props.disabled ? 0.6 : 1,
          }}
        > 
          {!value ? props.placeholder : value.name}
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
        aria-label={t("forms:combobox.select_single_option")}
      >
        <label
          className="focusable flex align-items-center gap-25 padding-block-50 padding-inline-25" 
          style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0', marginBottom: '3px' }}
          aria-label={t("forms:combobox.search_options")}
        >
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} />
          <input
            type="text"
            style={{ padding: '0', margin: '0', fontSize: 'revert' }}
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
                setValue(selectedOption?.value !== value?.value ? selectedOption : null); // TODO: Abstract this to use in onclick     
                setMenuOpen(false);
                toggleRef.current?.focus();
                if (onChange) onChange(selectedOption?.value !== value?.value ? selectedOption : null);
              }
            )}}
            role="combobox"
            aria-controls={`${props.id}-dialog-listbox`}
            aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("common:tsx.search") + t("common:tsx.ellipsis")}
          />
        </label>
        <ul
          id={`${props.id}-dialog-listbox`}
          className="margin-0 padding-0"
          role="listbox"
          aria-label={t("common:tsx.options")}
        >
          {searchResults.length > 0 ? (
            searchResults.map((option, index) => (
              <li  
                key={index}
                id={`${props.id}-dialog-listbox-${index}`}
                style={{backgroundColor: index === focusedListboxOption ? 'var(--gray-90)' : '' }}
                ref={(el) => { optionRefs.current[index] = el }}
                onClick={() => {
                  setValue(option.value !== value?.value ? option : null);
                  setMenuOpen(false);
                  if (onChange) onChange(option.value !== value?.value ? option : null);
                }}
                role="option"
                aria-selected={option.value === value?.value}
              >
                {option.name}
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