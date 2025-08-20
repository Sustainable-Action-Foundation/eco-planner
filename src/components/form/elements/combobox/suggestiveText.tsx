"use client"

import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from './comboBox.module.css' with { type: "css" }
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";
import { inputElement } from "@/components/types";
import { handleKeyDownEditableCombobox, scrollOptionIntoView } from "./functions";
   
// TODO: Decide on how to handle options/values here is it string or {name: string, value: string}? 

export default function SuggestiveText({
  props,
  options,
}: {
  props: inputElement
  options: Array<{name: string, value: string}>
}) {
  const { t } = useTranslation(["forms"]);

  const [value, setValue] = useState<string>(props.defaultValue ? props.defaultValue : '');
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null);
  // We only need this to ensure animations play. 
  // We set displayListBox to transition from opacity: 1 -> 0
  // Then renderListBox after 150ms (duration of transition) to set display: block -> none
  const [renderListBox, setRenderListBox] = useState<boolean>(false);
  const [displayListBox, setDisplayListBox] = useState<boolean>(false);

  // Refs
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const comboboxRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    const fuse = new Fuse(options, { keys: ['name'] });
    return value
      ? fuse.search(value).map(result => result.item)
      : options;
  }, [value, options]); 

  // Sroll listbox element into view
  useEffect(() => {
    scrollOptionIntoView(
      optionRefs.current,
      focusedListBoxItem
    ) 
  }, [focusedListBoxItem]);

  // Ensure animations are synced 
  useEffect(() => {
    if (displayListBox) {
      setRenderListBox(true)
    } else {
      setTimeout(() => {
        setRenderListBox(false);
      }, 150)
    }
  }, [displayListBox]); 

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style }}
    >
      <div className="flex align-items-center focusable">
        <input
          autoComplete="off" /* Disable default autocomplete behavior */
          type="text"
          placeholder={props.placeholder ? props.placeholder : undefined}
          name={props.name}
          id={props.id}
          required={props.required ? props.required : false}
          disabled={props.disabled}
          value={value}
          ref={comboboxRef}
          onChange={(e) => { setValue(e.target.value), setFocusedListBoxItem(0), optionRefs.current[0]?.scrollIntoView({ block: "nearest" }) }}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDownEditableCombobox(
            e,
            comboboxRef.current!, // TODO: Handle this in a better way maybe
            displayListBox,
            setDisplayListBox,
            searchResults,
            focusedListBoxItem,
            setFocusedListBoxItem,
            (selectedOption) => { 
              setValue(
                selectedOption 
                ? selectedOption.name
                : ""
              )
              setFocusedListBoxItem(null)
              setDisplayListBox(false);
            }
          )}
          onFocus={() => setDisplayListBox(true)}
          onBlur={(e) => { if (e.relatedTarget?.id != `${props.id}-listbox` && e.relatedTarget?.id != `${props.id}-button`) { setDisplayListBox(false) } }}
          role="combobox"
          aria-expanded={displayListBox}
          aria-haspopup="listbox"
          aria-controls={displayListBox ? `${props.id}-listbox` : undefined}
          aria-activedescendant={focusedListBoxItem != null ? `${props.id}-listbox-${focusedListBoxItem}` : undefined}
          aria-autocomplete="list" /* TODO input_updates: Implement features to enable this to have a value of "both" (tab to autocomplete inline)  */
        />
        {options.length > 0 ?
          <button
            id={`${props.id}-button`}
            className="round grid margin-right-25 transparent"
            style={{ padding: '2px' }}
            onClick={() => { comboboxRef.current?.focus(), setDisplayListBox(!displayListBox) }}
            type="button"
            tabIndex={-1}
            aria-pressed={displayListBox}
            aria-label={t("forms:suggestive_text.toggle_button")}
            title={t("forms:suggestive_text.toggle_button")}
          >
            <IconChevronDown aria-hidden="true" width={24} height={24} style={{ minWidth: '24px' }} />
          </button>
        : null}
      </div>

      {options.length > 0 ?
        <ul
          id={`${props.id}-listbox`}
          className={`
              ${!renderListBox ? 'display-none' : 'display-block'}
              ${styles['listbox']} 
              ${displayListBox ? styles['visible'] : ''} 
              margin-inline-0`
          }
          onBlur={(e) => { if (e.relatedTarget?.id != props.id) { setDisplayListBox(false) } }}
          role="listbox"
          tabIndex={-1}
          aria-label={t("forms:suggestive_text.listbox_label")}
          data-listbox-label={searchResults.length > 0 ? `${t("forms:suggestive_text.listbox_label")}` : `${t("forms:suggestive_text.listbox_empty_label")}`}
        >
          {searchResults.map((item, index) =>
            <li
              key={index}
              id={`${props.id}-listbox-${index}`}
              style={{ backgroundColor: index === focusedListBoxItem ? 'var(--gray-90)' : '', }} 
              ref={(el) => { optionRefs.current[index] = el }}
              onClick={() => { setValue(item.name), setDisplayListBox(false) }}
              role="option"
              aria-selected={item.name === value}
            >
              {item.name}
            </li>
          )}
        </ul>
        : null}
    </div>
  )
}