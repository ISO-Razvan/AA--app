import { formatSuma } from './SalariiPage.jsx'
import './SalariiDetaliuModal.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

export default function SalariiDetaliuModal({ tehnician, lunaLabel, randuri, onClose, onOpenLucrare }) {
  const total = randuri.reduce((sum, r) => sum + r.suma, 0)

  const handleRowClick = (lucrare) => {
    onClose()
    onOpenLucrare(lucrare)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="salarii-detaliu-modal" role="dialog" aria-modal="true" aria-label={`Detalii salariu ${tehnician.nume}`}>
        <header className="salarii-detaliu-header">
          <div>
            <h2>{tehnician.nume}</h2>
            <p className="salarii-detaliu-luna">{lunaLabel}</p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        </header>

        <div className="salarii-detaliu-summary">
          <span>{randuri.length} {randuri.length === 1 ? 'etapă finalizată' : 'etape finalizate'}</span>
          <span className="salarii-detaliu-total">{formatSuma(total)}</span>
        </div>

        <div className="salarii-detaliu-body">
          {randuri.length === 0 ? (
            <p className="salarii-status-text">Nicio etapă finalizată în această lună.</p>
          ) : (
            <ul className="salarii-detaliu-list">
              {randuri.map(({ alocare, lucrare, etapa, suma }) => (
                <li key={alocare.id}>
                  <button type="button" className="salarii-detaliu-row" onClick={() => handleRowClick(lucrare)}>
                    <div className="salarii-detaliu-row-top">
                      <span className="salarii-detaliu-nr">{lucrare.nr_inregistrare}</span>
                      {etapa && <span className="badge badge-purple">{etapa.nume}</span>}
                    </div>
                    <p className="salarii-detaliu-tip">{lucrare.tip_lucrare}</p>
                    <p className="salarii-detaliu-line">Pacient: {lucrare.pacient || '—'}</p>
                    <p className="salarii-detaliu-line">{clientLabel(lucrare)}</p>
                    <div className="salarii-detaliu-row-bottom">
                      <span className="salarii-detaliu-data">Finalizat: {formatData(alocare.data_finalizare)}</span>
                      <span className="salarii-detaliu-suma">{formatSuma(suma)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
