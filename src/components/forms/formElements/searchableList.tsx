"use client"

import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import styles from './searchableList.module.css'

// TODO: i18n
export default function SearchableList({
  list,
}: {
  list: Array<string>
}) {

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    const fuse = new Fuse(list);
    const results = searchTerm ? fuse.search(searchTerm).map(result => result.item) : list;
    setResults(results)
  }, [searchTerm]);

  return (
    <div className={`${styles['search-container']} position-relative`} style={{ width: 'fit-content' }}>
      <label>
        Search
        <div className="focusable flex align-items-center padding-50 margin-top-25">
          <IconSearch width={24} height={24} />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value) }}
            placeholder="sök..."
            className="padding-0 margin-left-50"
            style={{ borderRadius: '0' }}
          />
        </div>
      </label>
      <output>
        <div
          className="purewhite margin-block-25 smooth"
          style={{ border: '1px solid var(--gray-70)', padding: '3px', width: '100%' }}
        >
          {results.length > 0 ?
            <ul>
              {results.map((item, index) => (
                <li className="margin-bottom-25" key={index}>
                  <button role="button" aria-pressed="false" className="block width-100" style={{ borderRadius: '2px' }}>{item}</button>
                </li>
              ))}
            </ul>
            :
            <p className="margin-block-25">Inga resultat</p>
          }
        </div>
      </output>
    </div>
  )
}