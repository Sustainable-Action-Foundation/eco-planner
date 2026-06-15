"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from './comboBox.module.css' with { type: "css" };
import type { IFuseOptions } from "fuse.js";
import Fuse, { type FuseResult } from 'fuse.js';
import { useTranslation } from "react-i18next";
import type { InputElement, Option, Theme } from "@/components/types";
import { handleKeyDownTextAutocomplete, scrollOptionIntoView } from "./functions";

// TODO: This breaks the recipe editor
// TODO: Check tab completion against w3c implementation (and other keyboard functions + aria-states for that part...)
// TODO: Little annoying to select text when search field doesnt occupy the whole thing. 
// TODO: On double click should select

export default function TextSingleAutocomplete({
  props,
  theme, // TODO: Not a fan of this implementation
  options,
  fuseOptions,
  onChange,
  value,
  setter,
}: {
  props: InputElement
  theme?: Theme
  options: Array<Option>
  maxOptions?: number
  fuseOptions?: IFuseOptions<Option> // TODO: Implement for selects as well
  onChange?: (value: string) => void
  value: string
  setter: React.Dispatch<React.SetStateAction<string>>
}) {
  const { t } = useTranslation(["forms", "common"]);

  const [displayListBox, setDisplayListBox] = useState<boolean>(false);
  const [focusedListBoxItem, setFocusedListBoxItem] = useState<number | null>(null); // TODO: Rename -> focusedListBoxOption
  const [selectionMade, setSelectionMade] = useState(false); // TODO: Rename to something better
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const comboboxRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(options, {
    keys: ['name'],
    includeMatches: true,
    threshold: 0.0,
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
    scrollOptionIntoView(optionRefs.current, focusedListBoxItem);
  }, [focusedListBoxItem]);

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
        <strong key={start} className="font-weight-normal" style={{ color: 'hsl(206, 100%, 30%)', textShadow: '0 0 hsl(206, 100%, 50%)' }}>
          {text.slice(start, end + 1)}
        </strong>,
      );
      lastIndex = end + 1;
    });

    if (lastIndex < text.length) parts.push(text.slice(lastIndex));

    return <span>{parts}</span>;
  };

  useEffect(() => {
    if (
      focusedListBoxItem != null &&
      focusedListBoxItem >= searchResults.length
    ) {
      setFocusedListBoxItem(
        searchResults.length > 0 ? searchResults.length - 1 : null,
      );
    }
  }, [searchResults.length, focusedListBoxItem]);

  const activeIndex =
    focusedListBoxItem != null &&
    focusedListBoxItem >= 0 &&
    focusedListBoxItem < searchResults.length
      ? focusedListBoxItem
      : 0;

  const activeResult = searchResults[activeIndex]; 
  
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
        <input
          style={{ 
            fieldSizing: options.length > 0 ? 'content' : 'initial', 
            width: options.length > 0 ? 'auto' : '100%',
            padding: '0',
            anchorName: `--${props.id}-anchor`,
          }}
          type="text"
          placeholder={!!props.placeholder ? props.placeholder : undefined}
          name={props.name}
          id={props.id}
          required={!!props.required ? props.required : false}
          disabled={props.disabled}
          value={value}
          autoComplete="off"
          onChange={(e) => { 
            setter(e.target.value); 
            setFocusedListBoxItem(0);
          }}
          {...(options.length > 0
            ? {
              ref: comboboxRef,
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (!comboboxRef.current) return;

                handleKeyDownTextAutocomplete(
                  e,
                  comboboxRef.current,
                  displayListBox,
                  setDisplayListBox,
                  searchResults.map(r => r.item),
                  focusedListBoxItem,
                  setFocusedListBoxItem,
                  (selectedOption) => {
                    if (!displayListBox) return;
                    setter(selectedOption ? selectedOption.name : ""); // TODO: Should be .value?
                    setSelectionMade(true); 
                    setFocusedListBoxItem(null); 
                    setDisplayListBox(false);
                  },
                );
              },
              onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Backspace' && value.length === 0) {
                  setDisplayListBox(false);
                }
              },
              onFocus: () => { 
                if (value) { 
                  setDisplayListBox(true); 
                };
               },
              onBlur: (e) => { 
                if (e.relatedTarget?.id !== `${props.id}-listbox` && e.relatedTarget?.id !== `${props.id}-button` && displayListBox) {
                  setDisplayListBox(false); 
                  if (value) setter(activeResult?.item?.value ?? e.target.value);
                };
              },
              "role": "combobox",
              "aria-expanded": displayListBox,
              "aria-haspopup": "listbox",
              "aria-controls": displayListBox ? `${props.id}-listbox` : undefined,
              "aria-activedescendant": focusedListBoxItem != null ? `${props.id}-listbox-${focusedListBoxItem}` : undefined,
              "aria-autocomplete": "both", // TODO: This is only both if we look at just perfect matches (i.e threshold == 0)
            }
            : {})}
        />
        {searchResults.length > 0 && value && displayListBox ?
          <span style={{ color: 'gray', fontSize: 'smaller' }}>
            {activeResult?.item.name.toLowerCase().startsWith(value.toLowerCase())
              ? activeResult?.item.name.slice(value.length)
              : ''}
          </span>
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
            maxHeight: 'calc((24px * 6) + 6px)',
            width: 'auto',
            position: 'fixed',
            positionAnchor: `--${props.id}-anchor`,
            top: 'anchor(bottom)',
            left: value.length === 0 ? 'anchor(left)' : 'anchor(right)',
            positionTryFallbacks: 'flip-block',
            padding: '0',
            marginTop: '1rem',
            transformOrigin: 'top left',
          }}
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
                  setter(option.item.name); // TODO: Should be .value?
                  setSelectionMade(true);
                  setDisplayListBox(false);
                }}
                role="option"
                aria-selected={option.item.name === value}
                style={{
                  padding: '.25rem',
                  paddingLeft: '.5rem',
                }}
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