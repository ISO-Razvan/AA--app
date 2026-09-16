import { useState } from 'react'
import TaskuriZiPrint from './TaskuriZiPrint.jsx'
import './TaskuriZiModal.css'

function formatZiLunga(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatDataScurta(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

// „Termen" afișat per task — cea mai apropiată în timp dintre `next_date`
// (următoarea probă/control, editabilă doar din fișa lucrării) și
// `termen_predare`, cu eticheta care arată care dintre cele două e afișată.
export function termenPentru(lucrare) {
  const { next_date, termen_predare } = lucrare
  if (next_date && termen_predare) {
    return next_date <= termen_predare
      ? { data: next_date, eticheta: 'Next date' }
      : { data: termen_predare, eticheta: 'Termen predare' }
  }
  if (next_date) return { data: next_date, eticheta: 'Next date' }
  if (termen_predare) return { data: termen_predare, eticheta: 'Termen predare' }
  return { data: null, eticheta: null }
}

// Modal de detaliu al zilei — deschis din antetul unei zile din calendarul
// săptămânal al Task-urilor (Partea 37/41), listă completă cu bifă
// „Finalizat" proprie fiecărui task și descărcare PDF (Partea 42).
export default function TaskuriZiModal({ zi, tehnician, sarcini, onClose, onToggleFinalizat, onOpenLucrare }) {
  const [showPrint, setShowPrint] = useState(false)

  return (
    <>
      <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div className="taskuri-zi-modal" role="dialog" aria-modal="true" aria-label={`Task-uri ${tehnician.nume} — ${formatZiLunga(zi)}`}>
          <header className="taskuri-zi-modal-header">
            <div>
              <h2>{tehnician.nume}</h2>
              <p className="taskuri-zi-modal-data">{formatZiLunga(zi)}</p>
            </div>
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
              ✕
            </button>
          </header>

          <div className="taskuri-zi-modal-body">
            <div className="taskuri-zi-modal-toolbar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPrint(true)}
                disabled={sarcini.length === 0}
              >
                Descarcă PDF
              </button>
            </div>

            {sarcini.length === 0 ? (
              <p className="taskuri-panel-hint">Nicio sarcină programată pentru această zi.</p>
            ) : (
              <ul className="taskuri-zi-sarcini-list">
                {sarcini.map(({ alocare, lucrare }) => {
                  const termen = termenPentru(lucrare)
                  return (
                    <li key={alocare.id} className="taskuri-zi-sarcina-item">
                      <button type="button" className="taskuri-zi-sarcina-row" onClick={() => onOpenLucrare(lucrare)}>
                        <div className="taskuri-zi-sarcina-info">
                          <span className="taskuri-zi-sarcina-nr">{lucrare.nr_inregistrare}</span>
                          {alocare.finalizat && <span className="taskuri-zi-finalizat-badge">Finalizat</span>}
                          <span>
                            <span className="taskuri-zi-info-label">Pacient</span>
                            {lucrare.pacient || '—'}
                          </span>
                          <span>
                            <span className="taskuri-zi-info-label">Medic</span>
                            {clientLabel(lucrare)}
                          </span>
                          <span>
                            <span className="taskuri-zi-info-label">Tip lucrare</span>
                            {lucrare.tip_lucrare}
                          </span>
                          <span>
                            <span className="taskuri-zi-info-label">Nr. elemente</span>
                            {lucrare.nr_elemente}
                          </span>
                          <span>
                            <span className="taskuri-zi-info-label">Termen</span>
                            {formatDataScurta(termen.data)}
                            {termen.eticheta && <span className="taskuri-zi-termen-badge">{termen.eticheta}</span>}
                          </span>
                        </div>
                      </button>
                      <label className="taskuri-zi-checkbox">
                        <input
                          type="checkbox"
                          checked={!!alocare.finalizat}
                          onChange={() => onToggleFinalizat({ lucrare, alocare })}
                        />
                        <span>Finalizat</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showPrint && (
        <TaskuriZiPrint tehnician={tehnician} zi={zi} sarcini={sarcini} onClose={() => setShowPrint(false)} />
      )}
    </>
  )
}
