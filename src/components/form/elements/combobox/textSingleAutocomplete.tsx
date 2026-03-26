"use client"

import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from './comboBox.module.css' with { type: "css" }
import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import type { InputElement, Option, Theme } from "@/components/types";
import { handleKeyDownEditableCombobox, scrollOptionIntoView } from "./functions";

export default function TextSingleAutocomplete({
  props,
  theme, // TODO: Not a fan of this implementation
  options,
  maxOptions, // TODO: Rename (also not a big fan of this)
  fuseOptions,
  onChange,
}: {
  props: InputElement
  theme?: Theme
  options: Array<Option>
  maxOptions?: number
  fuseOptions?: IFuseOptions<Option> // TODO: Implement for selects aswell
  onChange?: (value: string) => void
}) {
  const { t } = useTranslation(["forms", "common"]);

  const [value, setValue] = useState<string>(props.defaultValue ? props.defaultValue : '');
  const [displayListBox, setDisplayListBox] = useState<boolean>(false);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null); // TODO: Rename -> focusedlistboxOption
  const [selectionMade, setSelectionMade] = useState(false); // TODO: Rename to something better
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const comboboxRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(options, { 
    keys: ['name'], 
    ...(fuseOptions ?? {}) 
  }), [options, fuseOptions]);

  const searchResults = useMemo(() => {
    if (selectionMade) {
      setSelectionMade(false); 
      return options; // Prevent fuse from unnecesserily running when selecting an item
    }
    return value ? fuse.search(value).map(result => result.item) : options;
  }, [value, fuse, options, selectionMade]);

  useEffect(() => {
    scrollOptionIntoView(optionRefs.current, focusedListBoxItem)
  }, [focusedListBoxItem, value]);

  useEffect(() => {
    if (!onChange) return
    onChange(value)
  }, [value, onChange])

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style }}
    >
      <div
        className={`${theme ? `${theme.className} ` : ''}flex align-items-center focusable`}
        style={theme?.style ?? {}}
      >
        <input
          type="text"
          placeholder={props.placeholder ? props.placeholder : undefined}
          name={props.name}
          id={props.id}
          required={props.required ? props.required : false}
          disabled={props.disabled}
          value={value}
          autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setFocusedListBoxItem(0) }} // TODO: Enter seems to select values even if nothing is selected
          {...(options.length > 0
            ? {
              ref: comboboxRef,
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                e.stopPropagation()
                if (!comboboxRef.current) return;
                handleKeyDownEditableCombobox(
                  e,
                  comboboxRef.current,
                  displayListBox,
                  setDisplayListBox,
                  searchResults,
                  focusedListBoxItem,
                  setFocusedListBoxItem,
                  (selectedOption) => {
                    setValue(selectedOption ? selectedOption.name : ""); // TODO: Should be .value?
                    setSelectionMade(true); 
                    setFocusedListBoxItem(null); 
                    setDisplayListBox(false);
                  }
                )
              },
              onFocus: () => setDisplayListBox(true),
              onBlur: (e) => { if (e.relatedTarget?.id != `${props.id}-listbox` && e.relatedTarget?.id != `${props.id}-button`) { setDisplayListBox(false) } },
              "role": "combobox",
              "aria-expanded": displayListBox,
              "aria-haspopup": "listbox",
              "aria-controls": displayListBox ? `${props.id}-listbox` : undefined,
              "aria-activedescendant": focusedListBoxItem != null ? `${props.id}-listbox-${focusedListBoxItem}` : undefined,
              "aria-autocomplete": "list" /* TODO input_updates: Implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
            }
            : {})}
        />
        {options.length > 0 ?
          <button
            id={`${props.id}-button`}
            className="round grid margin-right-25 transparent"
            style={{ padding: '2px' }}
            disabled={props.disabled}
            onClick={() => { comboboxRef.current?.focus(); setDisplayListBox(!displayListBox) }}
            type="button"
            tabIndex={-1}
            aria-pressed={displayListBox}
            aria-label={t("forms:combobox.show_suggestions")}
            title={t("forms:combobox.show_suggestions")}
          >
            <IconChevronDown aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} />
          </button>
          : null}
      </div>

      {options.length > 0 && searchResults.length > 0 ?
        <ul // TODO: Need somethin which indicates theese are just suggestions (aria-activedescendent does not change when blurring)
          id={`${props.id}-listbox`}
          className={`
              ${styles['listbox']} 
              ${displayListBox ? styles['visible'] : ''} 
              ${theme ? theme.className : ''}
              margin-inline-0`
          }
          style={{
            ...(theme?.style),
            maxHeight: maxOptions ? `${(maxOptions * 33) + 6}px` : '300px' // TODO: Implement for select comboboxes aswell
          }}
          // TODO: Onblur does not seem to actually setFocusedListBoxItem, figure out why...
          onBlur={(e) => { if (e.relatedTarget?.id != props.id) { setFocusedListBoxItem(null); setDisplayListBox(false); } }} // TODO: See if we can deal with blur the same way for all comboboxes
          role="listbox"
          tabIndex={-1}
          aria-label={t("common:tsx.suggestions")}
        >
          {searchResults.map((option, index) =>
            <li
              key={option.value}
              id={`${props.id}-listbox-${index}`}
              className={index === focusedListBoxItem ? styles['focused-option'] : ''}
              ref={(el) => { optionRefs.current[index] = el }}
              onClick={() => { 
                setValue(option.name); // TODO: Should be .value?
                setSelectionMade(true); 
                setDisplayListBox(false)
              }}
              role="option"
              aria-selected={option.name === value}
            >
              {option.name}
            </li>
          )}
        </ul>
        : null}
    </div>
  )
}