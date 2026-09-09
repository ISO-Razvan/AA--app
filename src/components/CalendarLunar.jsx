import { useState } from 'react'
import { azi } from '../utils/date'
import { LUNI, ZILE_SAPTAMANA, parseISO, toISO, zileInLuna, ziuaSaptamaniiPrimaZi } from '../utils/calendarUtils'
import './CalendarLunar.css'

// Calendar lunar complet (nu popover) — navigare între luni, o celulă per zi,
// cu indicator opțional de activitate (`countsByDay`). Folosit ca selector
// principal de zi în Task-uri (vedere manager și „Task-urile mele").
export default function CalendarLunar({ value, onChange, countsByDay = {} }) {
  const selected = parseISO(value)
  const [view, setView] = useState(() => selected || parseISO(azi()))

  const astaziISO = azi()
  const astazi = parseISO(astaziISO)
  const esteLunaCurenta = view.an === astazi.an && view.luna === astazi.luna

  const schimbaLuna = (delta) => {
    setView((prev) => {
      let luna = prev.luna + delta
      let an = prev.an
      if (luna < 1) {
        luna = 12
        an -= 1
      }
      if (luna > 12) {
        luna = 1
        an += 1
      }
      return { an, luna, zi: prev.zi }
    })
  }

  const totalZile = zileInLuna(view.an, view.luna)
  const offset = ziuaSaptamaniiPrimaZi(view.an, view.luna)
  const celule = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: totalZile }, (_, i) => i + 1),
  ]

  return (
    <div className="calendar-lunar">
      <div className="calendar-lunar-nav">
        <button
          type="button"
          className="calendar-lunar-nav-btn"
          onClick={() => schimbaLuna(-1)}
          aria-label="Luna anterioară"
        >
          ‹
        </button>
        <div className="calendar-lunar-nav-current">
          <span className="calendar-lunar-nav-label">
            {LUNI[view.luna - 1]} {view.an}
          </span>
          {!esteLunaCurenta && (
            <button
              type="button"
              className="btn btn-ghost calendar-lunar-today-btn"
              onClick={() => setView(astazi)}
            >
              Luna curentă
            </button>
          )}
        </div>
        <button
          type="button"
          className="calendar-lunar-nav-btn"
          onClick={() => schimbaLuna(1)}
          aria-label="Luna următoare"
        >
          ›
        </button>
      </div>

      <div className="calendar-lunar-weekdays">
        {ZILE_SAPTAMANA.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>

      <div className="calendar-lunar-grid">
        {celule.map((zi, i) => {
          if (zi === null) return <span key={`gol-${i}`} className="calendar-lunar-empty" />
          const iso = toISO(view.an, view.luna, zi)
          const count = countsByDay[iso] || 0
          const isSelected = value === iso
          const isAzi = astaziISO === iso
          return (
            <button
              key={zi}
              type="button"
              className={`calendar-lunar-day ${isSelected ? 'selected' : ''} ${isAzi ? 'today' : ''} ${count > 0 ? 'has-activity' : ''}`}
              onClick={() => onChange(iso)}
            >
              <span className="calendar-lunar-day-num">{zi}</span>
              {count > 0 && <span className="calendar-lunar-day-count">{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
