"use client"

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useEffect, useState, useRef } from "react"
import Fuse from "fuse.js";
import { useTranslation } from "react-i18next";

export function SelectSingleSearch({
  options,
  value,
  onChange,
}: {
  options: Array<string>,
  value: string,
  onChange: (newValue: string) => void
}) {
  const { t } = useTranslation(["forms"]);

  const extendedOptions = ['Select element', ...options];
  const [menuOpen, setMenuOpen] = useState<boolean>(false)
  const searchRef = useRef<HTMLInputElement>(null);

  // Fuse search
  const [results, setResults] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState<string>('')

  // Handle search results
  useEffect(() => {
    const fuse = new Fuse(extendedOptions);
    const newResults = searchValue ? fuse.search(searchValue).map(result => result.item) : extendedOptions;
    setResults(newResults);
  }, [searchValue]);

  // Focus search menu when open the select
  useEffect(() => {
    if (menuOpen) {
      searchRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <div className="position-relative" style={{ userSelect: 'none', width: 'fit-content' }}>
      <button
        type="button"
        className="flex gap-500 align-items-center"
        onClick={() => { setMenuOpen(!menuOpen) }}
        id="combo1"
        tabIndex={0}
        aria-controls="listbox1" // TODO: Fix this
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        aria-labelledby=""
        aria-activedescendant=""
        role="combobox"
      >
        {value}
        <IconSelector height={20} width={20} />
      </button>
      {/* TODO: Additionally, the listbox should be controlled by a search input which gets focus as soon as we press our buttons */}
      <div
        onBlur={() => setMenuOpen(false)}
        tabIndex={-1}
        role="dialog"
        style={{
          width: '100%',
          position: 'absolute',
          top: '100%',
          left: '0',
          backgroundColor: 'white',
          paddingBlock: '0',
          borderRadius: '.25rem',
          margin: '0',
          border: '1px solid var(--gray-80)',
          zIndex: '9',
          marginTop: '.25rem',
          maxHeight: '300px',
          overflowY: 'scroll',
          scrollbarWidth: 'thin',
          paddingInline: '3px',
          display: `${menuOpen ? 'block' : 'none'}`
        }}
      >
        <label
          aria-label="sök..."
          className="focusable flex align-items-center gap-25 padding-block-50 padding-inline-25" style={{ border: 'none', borderBottom: '1px solid var(--gray-80)', borderRadius: '0', marginBottom: '3px' }}>
          <IconSearch width={16} height={16} style={{ minWidth: '16px' }} />
          <input
            ref={searchRef}
            onChange={(e) => setSearchValue(e.target.value)}
            type="text"
            style={{
              padding: '0',
              margin: '0',
              fontSize: 'revert',
              borderRadius: '0' // TODO: Add this to the focusable class instead
            }}
          />
        </label>
        <ul
          role="listbox"
          id="listbox1"
          aria-labelledby=""
          className="margin-0 padding-0"
          style={{
            listStyle: 'none',
          }}>
          {results.map((option, index) => (
            <li
              onClick={() => {
                onChange(option)
                setMenuOpen(false)
              }}
              role="option"
              key={`$'listbox'-${index}`}
              style={{
                userSelect: 'none',
                borderRadius: '.25rem',
                padding: '.5rem',
                fontSize: 'smaller'
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}