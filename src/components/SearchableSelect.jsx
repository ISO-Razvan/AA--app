import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './SearchableSelect.css'

const LISTA_MAX_H = 220
const MARGINE = 8
const DISTANTA = 4

// Lista e randată în document.body (portal) cu position: fixed, ca să nu fie
// decupată de containerele cu overflow ale modalelor; se deschide în sus
// când dedesubt nu are loc în viewport.
function calculeazaPozitie(input) {
  const r = input.getBoundingClientRect()
  const jos = window.innerHeight - r.bottom - MARGINE - DISTANTA
  const sus = r.top - MARGINE - DISTANTA
  const inSus = jos < LISTA_MAX_H && sus > jos
  return {
    left: r.left,
    width: r.width,
    maxHeight: Math.max(80, Math.min(LISTA_MAX_H, inSus ? sus : jos)),
    ...(inSus ? { bottom: window.innerHeight - r.top + DISTANTA } : { top: r.bottom + DISTANTA }),
  }
}

// Dropdown cu căutare + opțiunea de a adăuga o valoare nouă direct din formular.
export default function SearchableSelect({
  label,
  value,
  onChange,
  options,
  onAddOption,
  placeholder = 'Selectează sau scrie...',
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [pozitie, setPozitie] = useState(null)
  const inputRef = useRef(null)

  const vizibil = !disabled && open

  useLayoutEffect(() => {
    if (!vizibil) return
    const actualizeaza = () => {
      if (inputRef.current) setPozitie(calculeazaPozitie(inputRef.current))
    }
    actualizeaza()
    // capture: true — prinde și scroll-ul din corpul modalului, nu doar al paginii.
    window.addEventListener('scroll', actualizeaza, true)
    window.addEventListener('resize', actualizeaza)
    return () => {
      window.removeEventListener('scroll', actualizeaza, true)
      window.removeEventListener('resize', actualizeaza)
    }
  }, [vizibil])

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
          disabled={disabled}
        />
        {vizibil && pozitie && createPortal(
          <ul
            className="searchable-select-dropdown"
            role="listbox"
            style={pozitie}
            onMouseDown={(e) => e.preventDefault()}
          >
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
          </ul>,
          document.body
        )}
      </div>
    </div>
  )
}
