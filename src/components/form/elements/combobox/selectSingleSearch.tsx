"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" };
import type { InputElement, Option } from "@/components/types";
import { clearEditableCombobox, handleKeyDownEditableCombobox, preventInvalidFormSubmission, scrollOptionIntoView } from "./functions";
import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";
import { IconSearch } from "@tabler/icons-react";

// TODO: Should allow for options with same values? Or we should check that they are unique?
// TODO: Show selected value inside the button, same goes for selectMultiple
// TODO: Fix anchor stuff for tree select and multiselect

export default function SelectSingleSearch({
  props,
  defaultValue,
  options,
  fuseOptions,
  onChange,
}: {
  props: InputElement,
  defaultValue?: Option | boolean,
  options: Array<Option>,
  fuseOptions?: IFuseOptions<Option>,
  onChange?: (value: Option | null) => void
}) {
  const { t } = useTranslation(["forms"]);

  // TODO: We probably need a check that default value exists in our options
  const [value, setValue] = useState<Option | null>(null);

  // Syncs default value to value
  // NOTE: Might want to explore if we can make this a controlled component (i.e Move state ownership to its parent) (would mean treating value and defaultvalue as any other standard input does)
  useEffect(() => {
    // Auto-select first option
    if (defaultValue === true && options.length > 0) {
      if (value?.value !== options[0].value) {
        setValue(options[0]);
      }
      return;
    }

    // If we explicitely state that we do not want a default value
    if (defaultValue === false) {
      if (value !== null) {
        setValue(null);
      }
      return;
    }

    // If we define an explicit default value 
    if (typeof defaultValue === "object" && defaultValue !== null) {
      if (value?.value !== defaultValue.value) {
        setValue(defaultValue);
      }
    }

  }, [defaultValue, options]);

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [focusedListboxOption, setFocusedListboxOption] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState<string>('');
  const [selectionMade, setSelectionMade] = useState(false); // TODO: Rename to something better
  const toggleRef = useRef<HTMLInputElement>(null); // TODO: Rename?
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const fuse = useMemo(() => new Fuse(options, {
    keys: ['name'],
    ...(fuseOptions ?? {}),
  }), [options, fuseOptions]);

  const searchResults = useMemo(() => {
    if (selectionMade) {
      setSelectionMade(false);
      return options; // Prevent fuse from unnecessarily running when selecting an item
    }
    return searchValue ? fuse.search(searchValue).map(result => result.item) : options;
  }, [searchValue, fuse, options, selectionMade]);

  // Disables form submission if value is invalid 
  // Define what an invalid value is (missing value or empty string). We only need this defined if the field is requied
  const valueIsValid = useMemo(() => {
    if ((!value || value.value === "") && props.required) return false;
    return true;
  }, [value, props.required]);

  useEffect(() => {
    if (!toggleRef.current) return;
    return preventInvalidFormSubmission(toggleRef.current, valueIsValid);
  }, [valueIsValid]);

  useEffect(() => {
    if (!searchRef.current) return;
    clearEditableCombobox(
      searchRef.current,
      setSearchValue,
      menuOpen,
      setFocusedListboxOption,
    );
  }, [menuOpen]);

  useEffect(() => {
    scrollOptionIntoView(optionRefs.current, focusedListboxOption);
  }, [focusedListboxOption]);

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style, userSelect: 'none' }}
    >
      <input
        type="text"
        placeholder={props.placeholder}
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '', anchorName: '--listbox-test-anchor' }}
        value={value ? value.value : ''}
        name={props.name}
        disabled={props.disabled}
        ref={toggleRef}
        onChange={() => {}}
        onClick={() => { setMenuOpen(!menuOpen); }}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key !== 'Tab') e.preventDefault(); // Prevent typing
        }}
        onPaste={(e) => e.preventDefault()} // Prevent pasting
        onDrop={(e) => e.preventDefault()} // Prevent copying
        role="combobox"
        required={!!props.required ? props.required : false}
        aria-controls={`${props.id}-dialog`}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-invalid={!valueIsValid}
      />
      <div
        id={`${props.id}-dialog`}
        className={`              
          ${styles['listbox']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        style={{
          positionAnchor: '--listbox-test-anchor',
          top: 'anchor(bottom)',
          left: 'anchor(left)',
          positionTryFallbacks: 'flip-block',
          position: 'fixed',
          width: 'anchor-size(width)',
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id !== props.id) {
            setFocusedListboxOption(null);
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"
        aria-label={t("forms:combobox.select_single_option")}
      >
        <label
          className="focusable flex align-items-center gap-25 padding-50 padding-inline-25 margin-25"
          style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', marginBottom: '2px', borderRadius: '0' }}
          aria-label={t("forms:combobox.search_options")}
        >
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} aria-hidden="true" />
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
                  setSelectionMade(true);
                  setMenuOpen(false);
                  toggleRef.current?.focus();
                  if (onChange) onChange(selectedOption?.value !== value?.value ? selectedOption : null);
                },
              );
            }}
            role="combobox"
            aria-controls={`${props.id}-dialog-listbox`}
            aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded={menuOpen}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("forms:combobox.default_search_placeholder")}
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
                key={option.value}
                id={`${props.id}-dialog-listbox-${index}`}
                className={index === focusedListboxOption ? styles['focused-option'] : ''}
                ref={(el) => { optionRefs.current[index] = el; }}
                onClick={() => {
                  setValue(option.value !== value?.value ? option : null);
                  setSelectionMade(true);
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
            <li className={`${styles['no-results']}`} >
              {t("common:tsx.no_results")}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}