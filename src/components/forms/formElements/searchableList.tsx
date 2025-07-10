"use client"

import { IconSearch, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import styles from './searchableList.module.css'
import { useRef } from "react";

// TODO: i18n
export default function SearchableList({
  list,
}: {
  list: Array<string>
}) {

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<string[]>([])
  const [chosenItems, setChosenItems] = useState<string[]>([])
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredResults = results.filter(item => !chosenItems.includes(item));

  useEffect(() => {
    if (focusedIndex >= filteredResults.length) {
      setFocusedIndex(filteredResults.length - 1);
    }
    if (filteredResults.length === 0) {
      setFocusedIndex(-1);
    }
  }, [filteredResults, focusedIndex]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [focusedIndex]);
  
  useEffect(() => {
    const fuse = new Fuse(list);
    const newResults = searchTerm ? fuse.search(searchTerm).map(result => result.item) : list;
    setResults(newResults);
    setFocusedIndex(-1); // reset focus when search results change
  }, [searchTerm]);

  useEffect(() => {
    const fuse = new Fuse(list);
    const results = searchTerm ? fuse.search(searchTerm).map(result => result.item) : list;
    setResults(results)
  }, [searchTerm]);

  return (
    <div className={`${styles['search-container']} position-relative`}>
      <input type="hidden" value={chosenItems.toString()} />
      <label htmlFor="search-elements">
        Search
      </label>
      <div className="flex align-items-center flex-wrap-wrap gap-25 padding-50 margin-top-25">
        <IconSearch width={24} height={24} style={{ minWidth: '24px' }} />
        {chosenItems.map((item, index) => (
          <span
            key={index}
            className="display-flex gap-25 align-items-center padding-25 smooth"
            style={{ backgroundColor: 'var(--gray-90)', whiteSpace: 'nowrap', fontSize: 'smaller', lineHeight: '1' }}
          >
            {/* TODO: Add focusable to span here */}
            {item}
            <button
              className="grid padding-0"
              onClick={() => setChosenItems(prev => prev.filter(index => index !== item))}
              type="button">
              <IconX width={12} height={12} strokeWidth={3} className="grid" />
            </button>
          </span>
        ))}
        <input
          id="search-elements"
          type="search"
          value={searchTerm}
          ref={inputRef}
          onChange={(e) => { setSearchTerm(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (focusedIndex == filteredResults.length - 1) {
                setFocusedIndex(0)
              } else {
                setFocusedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
              }
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (focusedIndex == 0) {
                setFocusedIndex(filteredResults.length - 1)
              } else {
                setFocusedIndex((prev) => Math.max(prev - 1, 0));
              }
            } else if (e.key === "Enter" && focusedIndex >= 0) {
              e.preventDefault();
              const selected = filteredResults[focusedIndex];
              if (selected && !chosenItems.includes(selected)) {
                setChosenItems(prev => [...prev, selected]);
              }
              setSearchTerm("");
              setFocusedIndex(-1);
            } else if (e.key === "Escape") {
              setSearchTerm("");
              setFocusedIndex(-1);
              inputRef.current?.blur();
            }
          }}
          placeholder="sök..."
          className="padding-0 flex-grow-100"
          style={{ borderRadius: '0', width: 'auto' }}
        />
      </div>
      <output>
        <div
          className="purewhite margin-block-25 smooth"
          style={{ border: '1px solid var(--gray-70)', padding: '3px', width: 'fit-content' }}
        >
          {filteredResults.length > 0 ?
            <ul
              tabIndex={-1}
            >
              {filteredResults.map((item, index) => (
                <li className="margin-bottom-25" key={index}>
                  <button
                    tabIndex={-1}
                    ref={(el) => { itemRefs.current[index] = el }}
                    type="button"
                    aria-pressed="false"
                    className={`block width-100 text-align-left transparent ${focusedIndex === index ? 'focused-class' : ''}`}
                    style={focusedIndex === index ? { backgroundColor: 'var(--gray-90)' } : {}}
                    onClick={() => {
                      if (!chosenItems.includes(item)) {
                        setChosenItems(prev => [...prev, item]);
                        setSearchTerm("")
                      }
                    }}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
            :
            <p className="margin-25" style={{ fontSize: 'smaller' }}>Inga resultat</p>
          }
        </div>
      </output>
    </div>
  )
}