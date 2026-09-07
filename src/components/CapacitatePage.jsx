import { useEffect, useMemo, useState } from 'react'
import { getTehnicieni, getEtapeProductie, getToateAlocarile, getLucrari } from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import TaskuriTehnicianModal from './TaskuriTehnicianModal.jsx'
import './CapacitatePage.css'

function zileleSaptamanii(offsetSaptamani) {
  const d = new Date()
  const zi = d.getDay() // 0=Duminică..6=Sâmbătă
  const diffLaLuni = zi === 0 ? -6 : 1 - zi
  const luniAzi = adaugaZile(azi(), diffLaLuni + offsetSaptamani * 7)
  return Array.from({ length: 7 }, (_, i) => adaugaZile(luniAzi, i))
}

function formatZiScurt(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatIntervalSaptamana(zile) {
  const prima = new Date(`${zile[0]}T00:00:00`)
  const ultima = new Date(`${zile[6]}T00:00:00`)
  const primaStr = prima.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
  const ultimaStr = ultima.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${primaStr} – ${ultimaStr}`
}

function formatOre(ore) {
  if (ore === 0) return '0h'
  return `${ore % 1 === 0 ? ore : ore.toFixed(1)}h`
}

export default function CapacitatePage() {
  const [tehnicieni, setTehnicieni] = useState([])
  const [etape, setEtape] = useState([])
  const [alocari, setAlocari] = useState([])
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [saptamanaOffset, setSaptamanaOffset] = useState(0)
  const [celulaDeschisa, setCelulaDeschisa] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, e, a, l] = await Promise.all([
        getTehnicieni(),
        getEtapeProductie(),
        getToateAlocarile(),
        getLucrari(),
      ])
      setTehnicieni(t)
      setEtape(e)
      setAlocari(a)
      setLucrari(l)
      setLoading(false)
    }
    load()
  }, [])

  const zile = useMemo(() => zileleSaptamanii(saptamanaOffset), [saptamanaOffset])
  const astazi = azi()

  const statPentru = (tehnicianId, zi) => {
    const randuri = alocari.filter((a) => a.tehnician_id === tehnicianId && a.data_planificata === zi)
    let ore = 0
    for (const r of randuri) {
      const lucrare = lucrari.find((l) => l.id === r.lucrare_id)
      const etapa = etape.find((e) => e.id === r.etapa_id)
      if (lucrare && etapa) {
        ore += ((Number(lucrare.nr_elemente) || 0) * (Number(etapa.durata_minute) || 0)) / 60
      }
    }
    return { count: randuri.length, ore }
  }

  return (
    <div className="capacitate-page">
      <h2>Capacitate</h2>
      <p className="capacitate-page-hint">
        Numărul de etape și orele de muncă estimate per tehnician, pe zi (nr. elemente × durata etapei din Setup).
      </p>

      <div className="capacitate-week-nav">
        <button
          type="button"
          className="btn btn-secondary capacitate-week-btn"
          onClick={() => setSaptamanaOffset((v) => v - 1)}
          aria-label="Săptămâna precedentă"
        >
          ←
        </button>
        <div className="capacitate-week-current">
          <span className="capacitate-week-label">{formatIntervalSaptamana(zile)}</span>
          {saptamanaOffset !== 0 && (
            <button type="button" className="btn btn-ghost capacitate-week-today" onClick={() => setSaptamanaOffset(0)}>
              Săptămâna curentă
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary capacitate-week-btn"
          onClick={() => setSaptamanaOffset((v) => v + 1)}
          aria-label="Săptămâna următoare"
        >
          →
        </button>
      </div>

      {loading ? (
        <p className="capacitate-loading">Se încarcă…</p>
      ) : tehnicieni.length === 0 ? (
        <div className="card capacitate-empty">
          <p>Niciun tehnician înregistrat încă. Adaugă tehnicieni din Setup → Tehnicieni.</p>
        </div>
      ) : (
        <div className="card capacitate-table-wrap">
          <table className="capacitate-table">
            <thead>
              <tr>
                <th className="capacitate-th-zi">Zi</th>
                {tehnicieni.map((t) => (
                  <th key={t.id}>{t.nume}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zile.map((zi) => (
                <tr key={zi} className={zi === astazi ? 'capacitate-row-azi' : ''}>
                  <td className="capacitate-td-zi">{formatZiScurt(zi)}</td>
                  {tehnicieni.map((t) => {
                    const { count, ore } = statPentru(t.id, zi)
                    return (
                      <td key={t.id}>
                        <button
                          type="button"
                          className={`capacitate-cell ${count === 0 ? 'capacitate-cell-empty' : ''}`}
                          onClick={() => setCelulaDeschisa({ tehnician: t, data: zi })}
                        >
                          {count === 0 ? (
                            <span className="capacitate-cell-dash">—</span>
                          ) : (
                            <>
                              <span className="capacitate-cell-count">{count} {count === 1 ? 'etapă' : 'etape'}</span>
                              <span className="capacitate-cell-ore">{formatOre(ore)}</span>
                            </>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {celulaDeschisa && (
        <TaskuriTehnicianModal
          tehnician={celulaDeschisa.tehnician}
          initialDate={celulaDeschisa.data}
          onClose={() => setCelulaDeschisa(null)}
        />
      )}
    </div>
  )
}
