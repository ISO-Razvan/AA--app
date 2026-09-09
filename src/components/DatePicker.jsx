import { useEffect, useRef, useState } from 'react'
import { azi } from '../utils/date'
import { LUNI, ZILE_SAPTAMANA, parseISO, toISO, formatAfisare, zileInLuna, ziuaSaptamaniiPrimaZi } from '../utils/calendarUtils'
import './DatePicker.css'

export default function DatePicker({ value, onChange, placeholder = 'zz.ll.aaaa', id, disabled = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const selected = parseISO(value)
  const [view, setView] = useState(() => selected || parseISO(azi()))

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const deschide = () => {
    setView(selected || parseISO(azi()))
    setOpen((v) => !v)
  }

  const schimbaLuna = (delta) => {
    setView((prev) => {
      let luna = prev.luna + delta
      let an = prev.an
      if (luna < 1) { luna = 12; an -= 1 }
      if (luna > 12) { luna = 1; an += 1 }
      return { an, luna, zi: prev.zi }
    })
  }

  const totalZile = zileInLuna(view.an, view.luna)
  const offset = ziuaSaptamaniiPrimaZi(view.an, view.luna)
  const celule = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: totalZile }, (_, i) => i + 1),
  ]
  const astaziISO = azi()

  return (
    <div className="datepicker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        onClick={deschide}
        disabled={disabled}
      >
        <span className={`custom-select-value ${value ? '' : 'custom-select-placeholder'}`}>
          {value ? formatAfisare(value) : placeholder}
        </span>
        <span className="custom-select-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6.5H14" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5.5 1.5V4M10.5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="datepicker-popover" role="dialog" aria-label="Alege data">
          <div className="datepicker-nav">
            <button type="button" className="datepicker-nav-btn" onClick={() => schimbaLuna(-1)} aria-label="Luna anterioară">
              ‹
            </button>
            <span className="datepicker-nav-label">{LUNI[view.luna - 1]} {view.an}</span>
            <button type="button" className="datepicker-nav-btn" onClick={() => schimbaLuna(1)} aria-label="Luna următoare">
              ›
            </button>
          </div>

          <div className="datepicker-weekdays">
            {ZILE_SAPTAMANA.map((z) => <span key={z}>{z}</span>)}
          </div>

          <div className="datepicker-grid">
            {celule.map((zi, i) => {
              if (zi === null) return <span key={`empty-${i}`} />
              const iso = toISO(view.an, view.luna, zi)
              const isSelected = value === iso
              const isAzi = astaziISO === iso
              return (
                <button
                  key={zi}
                  type="button"
                  className={`datepicker-day ${isSelected ? 'selected' : ''} ${isAzi ? 'today' : ''}`}
                  onClick={() => {
                    onChange(iso)
                    setOpen(false)
                  }}
                >
                  {zi}
                </button>
              )
            })}
          </div>

          <div className="datepicker-footer">
            <button
              type="button"
              className="btn btn-ghost datepicker-footer-btn"
              onClick={() => {
                onChange(astaziISO)
                setOpen(false)
              }}
            >
              Azi
            </button>
            {value && (
              <button
                type="button"
                className="btn btn-ghost datepicker-footer-btn"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Șterge
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
