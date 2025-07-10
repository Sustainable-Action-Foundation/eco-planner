"use client"

import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Fuse from "fuse.js";

// TODO: i18n
export default function SearchableList({
  list,
}: {
  list: Array<String>
}) {

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<String[]>([])

  useEffect(() => {
    const fuse = new Fuse(list);
    const results = searchTerm ? fuse.search(searchTerm).map(result => result.item) : list;
    setResults(results)
  }, [searchTerm]);

  return (
    <>
      <label>
        Search
        <div className="focusable flex align-items-center padding-50 margin-top-25">
          <IconSearch width={24} height={24} />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value) }}
            placeholder="sök..."
            className="padding-0 margin-inline-50"
            style={{ borderRadius: '0' }}
          />
        </div>
      </label>
      <output>
        <ul>
          {results.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </output>
    </>
  )
}