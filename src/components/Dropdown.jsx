import { useEffect, useRef, useState } from 'react'

// Dropdown custom pentru liste fixe (nu presupune adăugare de opțiuni noi,
// spre deosebire de SearchableSelect) — folosește aceeași paletă vizuală
// prin clasele .custom-select-* comune, definite în index.css.
export default function Dropdown({
  label,
  value,
  onChange,
  options,
  placeholder = 'Selectează…',
  emptyLabel,
  required = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const normalized = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const current = normalized.find((o) => o.value === value)

  const selecteaza = (v) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div className="dropdown-select" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="field-label">{label}{required && ' *'}</label>}
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`custom-select-value ${current ? '' : 'custom-select-placeholder'}`}>
          {current ? current.label : placeholder}
        </span>
        <span className="custom-select-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <ul className="custom-select-dropdown" role="listbox">
          {emptyLabel && (
            <li>
              <button
                type="button"
                className={`custom-select-option ${!value ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selecteaza('')
                }}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {normalized.length === 0 && !emptyLabel && (
            <li className="custom-select-option" style={{ color: 'var(--color-text-muted)' }}>Nicio opțiune</li>
          )}
          {normalized.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={`custom-select-option ${o.value === value ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selecteaza(o.value)
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
