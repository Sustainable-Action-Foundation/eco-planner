"use client";

import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from './comboBox.module.css' with { type: "css" };
import type { IFuseOptions } from "fuse.js";
import Fuse, { type FuseResult } from 'fuse.js';
import { useTranslation } from "react-i18next";
import type { InputElement, Option, Theme } from "@/components/types";
import { handleKeyDownEditableCombobox, scrollOptionIntoView } from "./functions";

// TODO: Bug where tabbing into the element doesnt focus the combobox (only happens if value === firstoption, also happens on mouse click i think...)
// TODO: This breaks the recipe editor
// TODO: Evaluate how we higlight, it doesnt look as good for example for leap params...
// TODO: Check tab completion against w3c implementation (and other keyboard functions + aria-states for that part...)
// TODO: Little annoying to select text when search field doesnt occupy the whole thing. 
// TODO: Tabbing should probably select and then move focus? I.e no prevent default?

export default function TextSingleAutocomplete({
  props,
  theme, // TODO: Not a fan of this implementation
  options,
  // maxOptions, // TODO: Rename (also not a big fan of this)
  fuseOptions,
  onChange,
}: {
  props: InputElement
  theme?: Theme
  options: Array<Option>
  maxOptions?: number
  fuseOptions?: IFuseOptions<Option> // TODO: Implement for selects as well
  onChange?: (value: string) => void
}) {
  const { t } = useTranslation(["forms", "common"]);

  // TODO: list of other suggestions that dont match exactly what you write.

  const [value, setValue] = useState<string>(!!props.defaultValue ? props.defaultValue : '');
  const [displayListBox, setDisplayListBox] = useState<boolean>(false);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null); // TODO: Rename -> focusedListBoxOption
  const [selectionMade, setSelectionMade] = useState(false); // TODO: Rename to something better
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const comboboxRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(options, { 
    keys: ['name'], 
    includeMatches: true,
    ...(fuseOptions ?? {}), 
  }), [options, fuseOptions]);
 
  const searchResults = useMemo((): FuseResult<Option>[] => {
    if (selectionMade) {
      setSelectionMade(false);
      return options.map(option => ({ item: option, matches: [], score: 1, refIndex: 0 })); // Prevent fuse from unnecessarily running when selecting an item
    }
    return value ? fuse.search(value) : options.map(option => ({ item: option, matches: [], score: 1, refIndex: 0 }));
  }, [value, fuse, options, selectionMade]);

  useEffect(() => {
    if (value) {
      setDisplayListBox(true);
    }

    scrollOptionIntoView(optionRefs.current, focusedListBoxItem);
  }, [focusedListBoxItem, value]);

  useEffect(() => {
    if (!onChange) return;
    onChange(value);
  }, [value, onChange]);  

  const highlightMatch = (text: string, indices?: readonly [number, number][]) => {
    if (!indices || indices.length === 0) return text;

    const parts = [];
    let lastIndex = 0;

    indices.forEach(([start, end]) => {
      if (start > lastIndex) parts.push(text.slice(lastIndex, start));
      parts.push(
        <strong key={start} className="font-weight-normal" style={{ color: 'hsl(206, 100%, 30%)', textShadow: '0 0 hsl(206, 100%, 50%)'}}>
          {text.slice(start, end + 1)}
        </strong>,
      );
      lastIndex = end + 1;
    });

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));

    return <span>{parts}</span>;
  };

  return (
    <div
      className={`${props.className ? `${props.className} ` : ''}position-relative`}
      style={{ ...props.style }}
      onClick={() => comboboxRef.current?.focus()}
    >
      <div
        className={`${theme ? `${theme.className} ` : ''}flex align-items-center focusable cursor-text padding-50`}
        style={theme?.style ?? {}}
      >  
        <input /* TODO: Need this input to be reduced to the size of what is being written. (field-sizing: content seems to work... but not on firefox) */
          style={{fieldSizing: options.length > 0 ? 'content' : 'initial', width: options.length > 0 ? 'auto' : '100%', padding: '0', anchorName: '--value-anchor'}}
          type="text"
          placeholder={!!props.placeholder ? props.placeholder : undefined}
          name={props.name}
          id={props.id}
          required={!!props.required ? props.required : false}
          disabled={props.disabled}
          value={value}
          autoComplete="off"
          onChange={(e) => { setValue(e.target.value); setFocusedListBoxItem(0); }} // TODO: Enter seems to select values even if nothing is selected
          {...(options.length > 0
            ? {
              ref: comboboxRef,
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (!comboboxRef.current) return;

                if (e.key === "Tab") { // Move this into the keydown function
                  if (displayListBox === false || e.shiftKey || searchResults.length > 0 && value === searchResults[0].item.value || !value) return; // Only tab complete if we have written something
                  setValue(searchResults[0].item.value);
                }
                
                handleKeyDownEditableCombobox(
                  e,
                  comboboxRef.current,
                  displayListBox,
                  setDisplayListBox,
                  searchResults.map(r => r.item),
                  focusedListBoxItem,
                  setFocusedListBoxItem,
                  (selectedOption) => {
                    setValue(selectedOption ? selectedOption.name : ""); // TODO: Should be .value?
                    setSelectionMade(true);
                    setFocusedListBoxItem(null); 
                    setDisplayListBox(false);
                  },
                );
              },
              onFocus: () => { if (value) {setDisplayListBox(true); }},
              onBlur: (e) => { if (e.relatedTarget?.id !== `${props.id}-listbox` && e.relatedTarget?.id !== `${props.id}-button`) { setDisplayListBox(false); } },
              "role": "combobox",
              "aria-expanded": displayListBox,
              "aria-haspopup": "listbox",
              "aria-controls": displayListBox ? `${props.id}-listbox` : undefined,
              "aria-activedescendant": focusedListBoxItem != null ? `${props.id}-listbox-${focusedListBoxItem}` : undefined,
              "aria-autocomplete": "both",
            }
            : {})}
        />
        {searchResults.length > 0 && value ? 
          <span style={{color: 'gray', fontSize: 'smaller'}}> {/* Might want the anchor on the input? Also rename it. */}
            {searchResults[0].item.name.toLowerCase().startsWith(value)
              ? searchResults[0].item.name.slice(value.length)
              : ''}
          </span>
        : null}
        {options.length > 0 ?
          <button
            id={`${props.id}-button`}
            className="padding-0 round grid transparent"
            style={{ marginLeft: 'auto' }}
            disabled={props.disabled}
            onClick={() => { comboboxRef.current?.focus(); setDisplayListBox(!displayListBox); }}
            type="button"
            tabIndex={-1}
            aria-pressed={displayListBox}
            aria-label={t("forms:combobox.show_suggestions")}
            title={t("forms:combobox.show_suggestions")}
          >
            <IconChevronDown aria-hidden="true" width={18} height={18} style={{ minWidth: '18px' }} />
          </button>
          : null}
      </div>

      {options.length > 0 && searchResults.length > 0 && (value || displayListBox) ?
        <ul // TODO: Need something which indicates these are just suggestions (aria-activedescendent does not change when blurring)
          id={`${props.id}-listbox`}
          className={`
              ${styles['listbox']} 
              ${styles['suggestive-text']} 
              ${displayListBox ? styles['visible'] : ''} 
              ${theme ? theme.className : ''}
              margin-inline-0 
              margin-top-100`
          }
          style={{
            ...(theme?.style),
            maxHeight: 'calc((33px * 7) + 6px)',
            // maxHeight: maxOptions ? `${(maxOptions * 33) + 6}px` : '300px',  TODO: Implement for select comboboxes as well
            width: 'auto',
            position: 'absolute',
            positionAnchor: '--value-anchor',
            top: 'anchor(bottom)',
            left: 'anchor(right)',
            padding: '0',
            marginTop: '1rem',
          }}
          // TODO: Onblur does not seem to actually setFocusedListBoxItem, figure out why...
          onBlur={(e) => { if (e.relatedTarget?.id !== props.id) { setFocusedListBoxItem(null); setDisplayListBox(false); } }} // TODO: See if we can deal with blur the same way for all comboboxes
          role="listbox"
          tabIndex={-1}
          aria-label={t("common:tsx.suggestions")}
        >
          {searchResults.map((option, index) => {
            const matchIndices = option.matches?.find(m => m.key === 'name')?.indices;
            
            return (
              <li
                key={option.item.value}
                id={`${props.id}-listbox-${index}`}
                className={index === focusedListBoxItem ? `${styles['focused-option']}` : ''}
                ref={(el) => { optionRefs.current[index] = el; }}
                onClick={() => { 
                  setValue(option.item.name); // TODO: Should be .value?
                  setSelectionMade(true); 
                  setDisplayListBox(false);
                }}
                role="option"
                aria-selected={option.item.name === value}
              > 
                {highlightMatch(option.item.name, matchIndices)}
              </li>
              );
            })}
        </ul>
        : null}
    </div>
  );
}