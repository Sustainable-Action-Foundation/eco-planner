"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from './comboBox.module.css' with { type: "css" };
import type { InputElement, Option } from "@/components/types";
import { clearEditableCombobox, handleKeyDownCombobox, handleKeyDownEditableCombobox, scrollOptionIntoView } from "./functions";
import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";
import { IconSearch } from "@tabler/icons-react";

// TODO: Should allow for options with same values? Or we should check that they are unique?
// TODO: Make sure we focus the searchref through a useeffect when we open the popup

export default function SelectMultipleSearch({
  props,
  defaultValue,
  options,
  fuseOptions,
  onChange,
}: {
  props: InputElement,
  defaultValue?: Option[],
  options: Option[],
  fuseOptions?: IFuseOptions<Option>,
  onChange?: (value: Option[] | null) => void
}) {
  const { t } = useTranslation(["forms", "common"]);
  const [value, setValue] = useState<Option[]>(defaultValue ?? []);
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

  useEffect(() => {
    if (!searchRef.current) return;
    clearEditableCombobox(
      searchRef.current,
      setSearchValue,
      menuOpen,
    );
  }, [menuOpen]);

  useEffect(() => {
    scrollOptionIntoView(optionRefs.current, focusedListboxOption);
  }, [focusedListboxOption]);

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{
        ...props.style,
        '--anchor-name': `--${props.id}-anchor`, // TODO: we want this to be an attribute once thats supported...  
      } as React.CSSProperties}
    >
      <input
        type="text"
        placeholder={props.placeholder}
        id={props.id}
        className={`${styles['select-toggle']}`}
        style={{ borderColor: menuOpen ? '#191919' : '' }}
        name={props.name}
        disabled={props.disabled}
        value={value.map((value) => value.value).toString()}
        ref={toggleRef}
        onChange={() => { }}
        onClick={() => { setMenuOpen(!menuOpen); }}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (!toggleRef.current) return;
          handleKeyDownCombobox(
            e,
            searchResults,
            setMenuOpen,
            focusedListboxOption,
            setFocusedListboxOption,
          );
        }}
        onPaste={(e) => e.preventDefault()} // Prevent pasting
        onDrop={(e) => e.preventDefault()} // Prevent copying
        role="combobox"
        required={props.required ? props.required : false}
        aria-controls={`${props.id}-dialog`}
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
      />
      <div
        id={`${props.id}-dialog`}
        className={`              
          ${styles['listbox']} 
          ${menuOpen ? styles['visible'] : ''} 
          margin-inline-0`
        }
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget?.id !== props.id) {
            setFocusedListboxOption(null);
            setMenuOpen(false);
          }
        }}
        tabIndex={-1}
        role="dialog"
        aria-label={t("forms:combobox.select_multiple_options")}
      >
        <label
          className="focusable flex align-items-center gap-25 padding-50 padding-inline-25 margin-25"
          style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0' }}
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
                    setSelectionMade(true);
                    if (onChange) onChange(newValue);
                  }
                },
              );
            }}
            role="combobox"
            aria-controls={`${props.id}-dialog-listbox`}
            aria-activedescendant={focusedListboxOption != null ? `${props.id}-dialog-listbox-${focusedListboxOption}` : undefined}
            aria-expanded="true"
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
          aria-multiselectable={true}
        >
          {searchResults.length > 0 ? (
            searchResults.map((option, index) => {
              return (
                <li
                  key={option.value}
                  id={`${props.id}-dialog-listbox-${index}`}
                  className={index === focusedListboxOption ? styles['focused-option'] : ''}
                  ref={(el) => { optionRefs.current[index] = el; }}
                  onClick={() => {
                    const optionPreviouslySelected = value.some(value => value.value === option.value);

                    const newValue = optionPreviouslySelected
                      ? value.filter(value => value.value !== option.value)
                      : [...value, option];

                    setValue(newValue);
                    setSelectionMade(true);

                    if (onChange) onChange(newValue);
                    searchRef.current?.focus(); // TODO: Might be a more clean way to do this
                  }}
                  role="option"
                  aria-selected={value.some(value => value.value === option.value)}
                >
                  {option.name}
                </li>
              );
            })
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