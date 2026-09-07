import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLucrari, getEtapeProductie, getProductieTehnician, setProductieAlocare } from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import PrintChecklist from './PrintChecklist.jsx'
import DatePicker from './DatePicker.jsx'
import './TaskuriTehnicianModal.css'

function formatZiLunga(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

export default function TaskuriTehnicianModal({ tehnician, onClose, initialDate }) {
  const navigate = useNavigate()
  const [data, setData] = useState(initialDate || azi())
  const [alocari, setAlocari] = useState([])
  const [lucrari, setLucrari] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [a, l, e] = await Promise.all([
        getProductieTehnician(tehnician.id),
        getLucrari(),
        getEtapeProductie(),
      ])
      setAlocari(a)
      setLucrari(l)
      setEtape(e)
      setLoading(false)
    }
    load()
  }, [tehnician.id])

  const sarciniZi = alocari
    .filter((a) => a.data_planificata === data)
    .map((a) => ({
      alocare: a,
      lucrare: lucrari.find((l) => l.id === a.lucrare_id),
      etapa: etape.find((e) => e.id === a.etapa_id),
    }))
    .filter((s) => s.lucrare)

  const handleSarcinaClick = (lucrare) => {
    onClose()
    navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)
  }

  const handleToggleFinalizat = async (alocare) => {
    const nextFinalizat = !alocare.finalizat
    const updated = await setProductieAlocare(alocare.lucrare_id, alocare.etapa_id, {
      finalizat: nextFinalizat,
      data_finalizare: nextFinalizat ? azi() : '',
    })
    setAlocari((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="taskuri-modal" role="dialog" aria-modal="true" aria-label={`Task-uri ${tehnician.nume}`}>
        <header className="taskuri-modal-header">
          <h2>{tehnician.nume}</h2>
          <div className="taskuri-modal-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowPrint(true)}>
              Printează
            </button>
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
              ✕
            </button>
          </div>
        </header>

        <div className="taskuri-day-nav">
          <button
            type="button"
            className="btn btn-secondary taskuri-day-btn"
            onClick={() => setData((d) => adaugaZile(d, -1))}
            aria-label="Ziua anterioară"
          >
            ←
          </button>
          <div className="taskuri-day-current">
            <span className="taskuri-day-label">{formatZiLunga(data)}</span>
            <div className="taskuri-day-input">
              <DatePicker value={data} onChange={setData} />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary taskuri-day-btn"
            onClick={() => setData((d) => adaugaZile(d, 1))}
            aria-label="Ziua următoare"
          >
            →
          </button>
        </div>

        <div className="taskuri-modal-body">
          {loading ? (
            <p className="taskuri-loading">Se încarcă…</p>
          ) : sarciniZi.length === 0 ? (
            <p className="taskuri-nicio-sarcina">Nicio sarcină programată pentru {formatZiLunga(data).toLowerCase()}.</p>
          ) : (
            <ul className="taskuri-sarcini-list">
              {sarciniZi.map(({ alocare, lucrare, etapa }) => (
                <li key={alocare.id} className={`taskuri-sarcina-item ${alocare.finalizat ? 'taskuri-sarcina-finalizata' : ''}`}>
                  <button
                    type="button"
                    className={`taskuri-checkbox ${alocare.finalizat ? 'checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleFinalizat(alocare)
                    }}
                    aria-pressed={!!alocare.finalizat}
                    aria-label={alocare.finalizat ? 'Marchează etapa ca nefinalizată' : 'Marchează etapa ca finalizată'}
                  >
                    {alocare.finalizat && '✓'}
                  </button>
                  <button type="button" className="taskuri-sarcina-row" onClick={() => handleSarcinaClick(lucrare)}>
                    <div className="taskuri-sarcina-top">
                      <span className="taskuri-sarcina-nr">{lucrare.nr_inregistrare}</span>
                      <div className="taskuri-sarcina-top-badges">
                        {etapa && <span className="badge badge-purple">{etapa.nume}</span>}
                        {alocare.finalizat && <span className="badge badge-success">Finalizat</span>}
                      </div>
                    </div>
                    <p className="taskuri-sarcina-tip">{lucrare.tip_lucrare}</p>
                    <p className="taskuri-sarcina-line">Pacient: {lucrare.pacient || '—'}</p>
                    <p className="taskuri-sarcina-line">{clientLabel(lucrare)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showPrint && (
        <PrintChecklist
          tehnician={tehnician}
          dataLabel={formatZiLunga(data)}
          sarcini={sarciniZi}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
