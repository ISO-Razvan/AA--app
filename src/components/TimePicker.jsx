import { useEffect, useRef, useState } from 'react'
import './TimePicker.css'

const ORE = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTE = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

export default function TimePicker({ value, onChange, placeholder = 'oo:mm', id, disabled = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const [ora, minut] = value ? value.split(':') : ['', '']

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const alege = (h, m) => {
    onChange(`${h}:${m}`)
  }

  return (
    <div className="timepicker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={`custom-select-value ${value ? '' : 'custom-select-placeholder'}`}>
          {value || placeholder}
        </span>
        <span className="custom-select-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 4.5V8L10.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="timepicker-popover" role="dialog" aria-label="Alege ora">
          <div className="timepicker-columns">
            <div className="timepicker-col">
              {ORE.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`timepicker-option ${h === ora ? 'selected' : ''}`}
                  onClick={() => alege(h, minut || '00')}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="timepicker-col">
              {MINUTE.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`timepicker-option ${m === minut ? 'selected' : ''}`}
                  onClick={() => alege(ora || '00', m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {value && (
            <button
              type="button"
              className="btn btn-ghost timepicker-clear"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Șterge
            </button>
          )}
        </div>
      )}
    </div>
  )
}
