"use client"

import { IconSearch, IconSelector } from "@tabler/icons-react";
import { useState } from "react";

export default function Combobox() {

  const [value, setValue] = useState<string>('');
  const [displayListBox, setDisplayListBox] = useState<boolean>(false)

  const handleKeyDownSearchInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Always clear input and remove listbox if pressing escape
    if (e.key === 'Escape') {
      setValue('')
      setDisplayListBox(false)
    }

    if (e.key === 'ArrowDown') {
      if (displayListBox) {
        return
      } else {
        setDisplayListBox(true)
      }
    }

    if (e.key === 'ArrowUp') {
      if (!displayListBox) {
        return
      } else {
        setDisplayListBox(false)
      }
    }
  };
  
  return (
    <>
      <div className="flex align-items-center focusable">
        <IconSearch className="margin-left-50" />
        <input 
          value={value}
          onChange={(e) => setValue(e.target.value)} 
          onKeyDown={handleKeyDownSearchInput}
          role="combobox" 
          type="text" 
          placeholder="Sök.."
        />
        <button 
          onClick={() => setDisplayListBox(!displayListBox)}
          aria-label="toggle listbox"
          type="button" 
          className="grid" 
          tabIndex={-1}  
        >
          <IconSelector aria-hidden="true" />
        </button>
      </div>

      {value || displayListBox ? 
        <ul role="listbox" id="listbox" className="margin-inline-0 padding-0">
          <button role="option" aria-selected="false">1</button>
          <button role="option" aria-selected="false">2</button>
          <button role="option" aria-selected="false">3</button>
        </ul>
      : null }
    </>
  )
}