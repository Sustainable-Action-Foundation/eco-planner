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
        <button 
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          id="combo1"
          tabIndex={0}
          aria-controls="listbox1"
          aria-expanded={menuOpen}
          aria-haspopup="listbox" // TODO: Should open dialog
          aria-labelledby=""
          aria-activedescendant=""
          role="combobox"
        >
          {value}
        <IconSelector />
      </button> 
      {/* TODO: Listbox should be a child of a dialog which the button opens. */}
      {/* TODO: Additionally, the listbox should be controlled by a search input which gets focus as soon as we press our buttons */} 
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