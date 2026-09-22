import { useState } from 'react'
import Dropdown from './Dropdown.jsx'
import TaskuriZiPrint from './TaskuriZiPrint.jsx'
import './modal-base.css'
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
// săptămânal al Task-urilor, listă completă cu bifă „Finalizat" proprie
// fiecărui task și descărcare PDF. Pe mobil (isMobil), unde drag & drop-ul
// din calendar e dezactivat, adaugă și „editare directă": asignarea unei
// lucrări neplanificate în ziua curentă, mutarea unui task în altă zi și
// scoaterea lui din planificare — toate prin selecturi, nu prin tragere.
export default function TaskuriZiModal({
  zi,
  zileSaptamana,
  numeZile,
  tehnician,
  sarcini,
  lucrariNeplanificate,
  isMobil,
  onClose,
  onToggleFinalizat,
  onOpenLucrare,
  onAsigneaza,
  onMuta,
  onElimina,
}) {
  const [showPrint, setShowPrint] = useState(false)
  const [selectieNoua, setSelectieNoua] = useState('')
  const [asignand, setAsignand] = useState(false)

  const optiuniNeplanificate = (lucrariNeplanificate || []).map(({ lucrare, etape }) => ({
    value: `${lucrare.id}|${etape.map((e) => e.id).join(',')}`,
    label: `${lucrare.nr_inregistrare} — ${lucrare.pacient || '—'} (${etape.map((e) => e.nume).join(' + ')})`,
  }))

  const optiuniZile = (zileSaptamana || []).map((z, i) => ({ value: z, label: numeZile?.[i] || z }))

  const handleAsigneaza = async () => {
    if (!selectieNoua) return
    const [lucrareId, etapaIdsStr] = selectieNoua.split('|')
    setAsignand(true)
    try {
      await onAsigneaza(lucrareId, etapaIdsStr.split(','))
      setSelectieNoua('')
    } finally {
      setAsignand(false)
    }
  }

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

            {isMobil && (
              <div className="taskuri-zi-adaugare">
                <Dropdown
                  label="Adaugă o lucrare neplanificată în această zi"
                  value={selectieNoua}
                  onChange={setSelectieNoua}
                  options={optiuniNeplanificate}
                  placeholder={optiuniNeplanificate.length === 0 ? 'Nicio lucrare neplanificată' : 'Alege o lucrare…'}
                  disabled={optiuniNeplanificate.length === 0 || asignand}
                />
                <button
                  type="button"
                  className="btn btn-secondary taskuri-zi-adaugare-btn"
                  onClick={handleAsigneaza}
                  disabled={!selectieNoua || asignand}
                >
                  {asignand ? 'Se adaugă…' : '+ Adaugă în această zi'}
                </button>
              </div>
            )}

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

                      <div className="taskuri-zi-sarcina-actions">
                        <label className="taskuri-zi-checkbox">
                          <input
                            type="checkbox"
                            checked={!!alocare.finalizat}
                            onChange={() => onToggleFinalizat({ lucrare, alocare })}
                          />
                          <span>Finalizat</span>
                        </label>

                        {isMobil && (
                          <div className="taskuri-zi-muta">
                            <Dropdown
                              value={zi}
                              onChange={(v) => {
                                if (v && v !== zi) onMuta(lucrare.id, alocare.etapa_id, v)
                              }}
                              options={optiuniZile}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost taskuri-zi-elimina-btn"
                              onClick={() => onElimina(lucrare.id, alocare.etapa_id)}
                            >
                              Scoate din planificare
                            </button>
                          </div>
                        )}
                      </div>
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
