import { useMemo, useRef, useState } from 'react'
import './SearchableSelect.css'

// Dropdown cu căutare + opțiunea de a adăuga o valoare nouă direct din formular.
export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  onAddOption,
  placeholder = 'Selectează sau scrie...',
  required = false,
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef(null)

  const trimmed = value.trim()
  const exactMatch = options.some((o) => o.toLowerCase() === trimmed.toLowerCase())

  const filtered = useMemo(() => {
    if (!trimmed) return options
    return options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
  }, [options, trimmed])

  const selectOption = (opt) => {
    onChange(opt)
    setOpen(false)
  }

  const handleAddNew = async () => {
    if (!trimmed || adding) return
    setAdding(true)
    try {
      const saved = await onAddOption(trimmed)
      onChange(saved)
    } finally {
      setAdding(false)
      setOpen(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!exactMatch && trimmed) handleAddNew()
      else setOpen(false)
    }
  }

  return (
    <div className="searchable-select">
      {label && <label className="field-label">{label}{required && ' *'}</label>}
      <div className="searchable-select-box">
        <input
          ref={inputRef}
          type="text"
          className="text-input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {open && (
          <ul className="searchable-select-dropdown" role="listbox">
            {filtered.length === 0 && !trimmed && (
              <li className="searchable-select-empty">Nicio opțiune încă</li>
            )}
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  className="searchable-select-option"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectOption(opt)
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
            {trimmed && !exactMatch && (
              <li>
                <button
                  type="button"
                  className="searchable-select-option searchable-select-add"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleAddNew()
                  }}
                  disabled={adding}
                >
                  {adding ? 'Se adaugă…' : `+ Adaugă „${trimmed}”`}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
