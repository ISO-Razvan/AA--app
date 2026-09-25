import { createPortal } from 'react-dom'
import './PrintChecklist.css'

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
                    <span className="print-sheet-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                    {etapa && <span className="print-sheet-etapa">{etapa.nume}</span>}
                  </p>
                  <p className="print-sheet-sub rezumat-medic">{lucrare.medic || '—'}</p>
                  <p className="print-sheet-sub rezumat-tip">{lucrare.tip_lucrare}</p>
                  <p className="print-sheet-sub">
                    <span className="print-sheet-nr">{lucrare.nr_inregistrare}</span>
                    {lucrare.clinica && ` · ${lucrare.clinica}`}
                  </p>
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
