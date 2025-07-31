import { IconSelector } from "@tabler/icons-react";
import { useState } from "react"

export function SelectSingleSearch({
  options, 
  value,
  onChange,
}: {
  options: Array<string>,
  value: string,
  onChange: (newValue: string) => void
}) {

  const extendedOptions = ['select element', ...options];

  const [menuOpen, setMenuOpen] = useState<boolean>(false)
 
  return (
    <div className="position-relative" style={{userSelect: 'none'}}>
      <div className="focusable">
        <span
          onClick={() => setMenuOpen(!menuOpen)}
          id="combo1"
          tabIndex={0}
          aria-controls="listbox1"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          aria-labelledby=""
          aria-activedescendant=""
          role="combobox"
        >
          {value}
        </span> 
        <IconSelector />
      </div>
      <ul
        role="listbox"
        id="listbox1"
        aria-labelledby=""
        className="margin-0 padding-0"
        style={{ 
          position: 'absolute', 
          top: '100%', 
          left: '0', 
          backgroundColor: 'white',
          listStyle: 'none',
          padding: '.25rem',
          borderRadius: '.25rem',
          zIndex: '1',
          marginTop: '.25rem',
          display: `${menuOpen ? 'block' : 'none'}`  
        }}>
        {extendedOptions.map((option, index) => (
          <li 
            onClick={() => {
              onChange(option)
              setMenuOpen(false)
            }}
            role="option"
            key={`$'listbox'-${index}`}
          >
            {option}
          </li>
        ))}
      </ul>
    </div>
  )
}