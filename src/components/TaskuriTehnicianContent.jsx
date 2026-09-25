import { useEffect, useMemo, useState } from 'react'
import { getLucrari, getEtapeProductie, getProductieTehnician, setFinalizareEtapa } from '../services/dataService'
import { azi } from '../utils/date'
import CalendarLunar from './CalendarLunar.jsx'
import PrintChecklist from './PrintChecklist.jsx'
import DeschideFisaButton from './DeschideFisaButton.jsx'
import './TaskuriTehnicianContent.css'

function formatZiLunga(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Conținutul comun al vederii „sarcinile unui tehnician, pe zi" — calendar
// lunar + lista zilei + bifare finalizat + print checklist. Reutilizat atât
// în modalul de manager (TaskuriTehnicianModal), cât și în pagina
// „Task-urile mele" a tehnicianului logat (TaskurileMelePage) — fiecare
// wrapper își decide doar chrome-ul (modal vs. pagină) și ce înseamnă
// „deschide lucrarea" (`onOpenLucrare`).
export default function TaskuriTehnicianContent({ tehnician, initialDate, onOpenLucrare }) {
  const [data, setData] = useState(initialDate || azi())
  const [alocari, setAlocari] = useState([])
  const [lucrari, setLucrari] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPrint, setShowPrint] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [a, l, e] = await Promise.all([
        getProductieTehnician(tehnician.id),
        getLucrari(),
        getEtapeProductie(),
      ])
      // O lucrare arhivată nu mai apare în calendar/listă și nu mai poate
      // primi etape noi — filtrăm atât lucrările, cât și alocările lor.
      const lucrariActive = l.filter((x) => !x.arhivat)
      const idActive = new Set(lucrariActive.map((x) => x.id))
      setAlocari(a.filter((al) => idActive.has(al.lucrare_id)))
      setLucrari(lucrariActive)
      setEtape(e)
      setLoading(false)
    }
    load()
  }, [tehnician.id])

  const countsByDay = useMemo(() => {
    const map = {}
    for (const a of alocari) {
      if (!a.data_planificata) continue
      map[a.data_planificata] = (map[a.data_planificata] || 0) + 1
    }
    return map
  }, [alocari])

  const sarciniZi = alocari
    .filter((a) => a.data_planificata === data)
    .map((a) => ({
      alocare: a,
      lucrare: lucrari.find((l) => l.id === a.lucrare_id),
      etapa: etape.find((e) => e.id === a.etapa_id),
    }))
    .filter((s) => s.lucrare)

  const handleToggleFinalizat = async (alocare) => {
    const updated = await setFinalizareEtapa(alocare.lucrare_id, alocare.etapa_id, !alocare.finalizat)
    setAlocari((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  return (
    <div className="taskuri-continut">
      <div className="taskuri-continut-top">
        <CalendarLunar value={data} onChange={setData} countsByDay={countsByDay} />
        <div className="taskuri-continut-day-row">
          <span className="taskuri-day-label">{formatZiLunga(data)}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPrint(true)}>
            Printează
          </button>
        </div>
      </div>

      <div className="taskuri-continut-body">
        {loading ? (
          <p className="taskuri-loading">Se încarcă…</p>
        ) : sarciniZi.length === 0 ? (
          <p className="taskuri-nicio-sarcina">Nicio sarcină programată pentru {formatZiLunga(data).toLowerCase()}.</p>
        ) : (
          <ul className="taskuri-sarcini-list">
            {sarciniZi.map(({ alocare, lucrare, etapa }) => (
              <li key={alocare.id} className={`taskuri-sarcina-item ${alocare.finalizat ? 'taskuri-sarcina-finalizata' : ''}`}>
                <label className="taskuri-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!!alocare.finalizat}
                    onChange={() => handleToggleFinalizat(alocare)}
                    aria-label={alocare.finalizat ? 'Marchează etapa ca nefinalizată' : 'Marchează etapa ca finalizată'}
                  />
                </label>
                <button type="button" className="taskuri-sarcina-row" onClick={() => onOpenLucrare(lucrare)}>
                  <div className="taskuri-sarcina-top">
                    <span className="taskuri-sarcina-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                    <div className="taskuri-sarcina-top-badges">
                      {etapa && <span className="badge badge-purple">{etapa.nume}</span>}
                      {alocare.finalizat && <span className="badge badge-success">Finalizat</span>}
                    </div>
                  </div>
                  <p className="taskuri-sarcina-line rezumat-medic">{lucrare.medic || '—'}</p>
                  <p className="taskuri-sarcina-line rezumat-tip">{lucrare.tip_lucrare}</p>
                  <p className="taskuri-sarcina-line taskuri-sarcina-meta">
                    <span className="taskuri-sarcina-nr">{lucrare.nr_inregistrare}</span>
                    {lucrare.clinica && ` · ${lucrare.clinica}`}
                  </p>
                </button>
                <DeschideFisaButton className="taskuri-sarcina-fisa" onClick={() => onOpenLucrare(lucrare)} />
              </li>
            ))}
          </ul>
        )}
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
