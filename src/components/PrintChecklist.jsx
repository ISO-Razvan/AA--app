import { createPortal } from 'react-dom'
import './PrintChecklist.css'

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

export default function PrintChecklist({ tehnician, dataLabel, sarcini, onClose }) {
  return createPortal(
    <div className="print-overlay">
      <div className="print-overlay-toolbar no-print">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Închide
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Printează
        </button>
      </div>

      <div className="print-sheet">
        <h2>{tehnician.nume}</h2>
        <p className="print-sheet-data">{dataLabel}</p>

        {sarcini.length === 0 ? (
          <p className="print-sheet-empty">Nicio sarcină programată pentru această zi.</p>
        ) : (
          <ul className="print-sheet-list">
            {sarcini.map(({ alocare, lucrare, etapa }) => (
              <li key={alocare.id}>
                <span className="print-checkbox" aria-hidden="true">☐</span>
                <div className="print-sheet-item-body">
                  <p className="print-sheet-item-top">
                    <span className="print-sheet-nr">{lucrare.nr_inregistrare}</span>
                    {etapa && <span className="print-sheet-etapa">{etapa.nume}</span>}
                  </p>
                  <p className="print-sheet-sub">{lucrare.tip_lucrare}</p>
                  <p className="print-sheet-sub">Pacient: {lucrare.pacient || '—'} · {clientLabel(lucrare)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  )
}
