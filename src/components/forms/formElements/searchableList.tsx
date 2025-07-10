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
  const [chosenItem, setChosenItem] = useState<string[] | string>('')
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
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
    if (chosenItem !== null) {
      console.log('New chosenItem:', chosenItem);
    }
  }, [chosenItem]);

  useEffect(() => {
    const fuse = new Fuse(list);
    const results = searchTerm ? fuse.search(searchTerm).map(result => result.item) : list;
    setResults(results)
  }, [searchTerm]);

  return (
    <div className={`${styles['search-container']} position-relative`}>
      <label>
        Search
        <div className="focusable flex align-items-center padding-50 margin-top-25">
          <IconSearch width={24} height={24} />
          {chosenItem ?
            <span 
              className="display-flex gap-50 align-items-center margin-left-50 padding-block-25 padding-inline-50 smooth" 
              style={{ backgroundColor: 'var(--gray-90)', whiteSpace: 'nowrap'}}
            >
              {/* TODO: Add focusable to span here */}
              {chosenItem}
              <button
                className="grid padding-0"
                onClick={() => { setChosenItem('') }}
                type="button">
                <IconX width={12} height={12} strokeWidth={3} />
              </button>
            </span>
            : null}
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Enter" && focusedIndex >= 0) {
                e.preventDefault();
                setChosenItem(results[focusedIndex]);
                setSearchTerm(""); // clear search or hide list if needed
              } else if (e.key === "Escape") {
                setSearchTerm("");
                setFocusedIndex(-1);
              }
            }}
            placeholder="sök..."
            className="padding-0 margin-left-50"
            style={{ borderRadius: '0' }}
          />
        </div>
      </label>
      <output>
        <div
          className="purewhite margin-block-25 smooth"
          style={{ border: '1px solid var(--gray-70)', padding: '3px', width: 'fit-content' }}
        >
          {results.length > 0 ?
            <ul 
              tabIndex={-1}
            >
              {results.map((item, index) => (
                <li className="margin-bottom-25" key={index}>
                  <button
                    tabIndex={-1}
                    ref={(el) => {itemRefs.current[index] = el}}
                    type="button"
                    aria-pressed="false"
                    className={`block width-100 text-align-left transparent ${focusedIndex === index ? 'focused-class' : ''}`}
                    style={focusedIndex === index ? { backgroundColor: 'var(--gray-80)' } : {}}
                    onClick={() => setChosenItem(item)}
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