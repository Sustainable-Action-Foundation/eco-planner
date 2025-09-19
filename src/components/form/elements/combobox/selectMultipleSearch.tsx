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

export default function SelectMultipleSearch({
  props,
  defaultValue,
  options,
  onChange,
}: {
  props: inputElement,
  defaultValue?: Array<option>,
  options: Array<option>,
  onChange?: (value: Array<option> | null) => void
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [value, setValue] = useState<Array<option>>(
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
        type="button"
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        name={props.name}
        disabled={props.disabled}
        value={value.map((value) => value.value).toString()}
        ref={toggleRef} 
        onClick={() => { setMenuOpen(!menuOpen) }}
        role="combobox"
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
        aria-label={t("forms:combobox.select_multiple_options")}
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
          aria-multiselectable={true}
        >
          {searchResults.length > 0 ? (
            searchResults.map((option, index) => {
              return (
                <li
                  key={index}
                  id={`${props.id}-dialog-listbox-${index}`}
                  style={{backgroundColor: index === focusedListboxOption ? 'var(--gray-90)' : ''}}
                  ref={(el) => { optionRefs.current[index] = el }}
                  onClick={() => { 
                    const optionPreviouslySelected = value.some(value => value.value === option.value);

                    const newValue = optionPreviouslySelected
                      ? value.filter(value => value.value !== option.value) 
                      : [...value, option];

                    setValue(newValue);

                    if (onChange) onChange(newValue);
                    searchRef.current?.focus() // TODO: Might be a more clean way to do this
                  }}
                  role="option"
                  aria-selected={value.some(value => value.value === option.value)}
                >
                  {option.name}
                </li>
              )
            })
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