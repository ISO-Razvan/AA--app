import { useEffect, useMemo, useState } from 'react'
import { getLucrari } from '../services/dataService'
import { azi } from '../utils/date'
import { formatSuma } from './SalariiPage.jsx'
import './FinanciarPrezentare.css'

const NUME_LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

function lunaCurenta() {
  const [an, luna] = azi().split('-')
  return { an: Number(an), luna: Number(luna) }
}

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

export default function FinanciarPrezentare({ onOpenLucrare }) {
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [luna, setLuna] = useState(lunaCurenta)
  const [modPerioada, setModPerioada] = useState('luna') // 'luna' | 'tot'
  const [modGrupare, setModGrupare] = useState('clinica') // 'clinica' | 'medic'

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLucrari(await getLucrari())
      setLoading(false)
    }
    load()
  }, [])

  const lunaPrefix = `${luna.an}-${String(luna.luna).padStart(2, '0')}`
  const esteLunaCurenta = lunaPrefix === azi().slice(0, 7)
  const lunaLabel = `${NUME_LUNI[luna.luna - 1]} ${luna.an}`

  const schimbaLuna = (delta) => {
    setLuna((prev) => {
      let l = prev.luna + delta
      let a = prev.an
      if (l < 1) { l = 12; a -= 1 }
      if (l > 12) { l = 1; a += 1 }
      return { an: a, luna: l }
    })
  }

  // Doar lucrările arhivate contează pentru rapoartele financiare — arhivarea
  // marchează momentul în care o lucrare e considerată „încheiată" financiar.
  const lucrariArhivate = useMemo(() => lucrari.filter((l) => l.arhivat && l.data_arhivare), [lucrari])

  const lucrariLunaSelectata = useMemo(
    () => lucrariArhivate.filter((l) => l.data_arhivare.slice(0, 7) === lunaPrefix),
    [lucrariArhivate, lunaPrefix]
  )

  const totalProdus = useMemo(() => lucrariLunaSelectata.reduce((sum, l) => sum + (Number(l.incasare) || 0), 0), [lucrariLunaSelectata])
  const totalCheltuit = useMemo(() => lucrariLunaSelectata.reduce((sum, l) => sum + (Number(l.cost_laborator) || 0), 0), [lucrariLunaSelectata])
  const profit = totalProdus - totalCheltuit

  const sursaPerioada = modPerioada === 'luna' ? lucrariLunaSelectata : lucrariArhivate
  const perioadaLabel = modPerioada === 'luna' ? lunaLabel : 'tot istoricul'

  const top10 = useMemo(
    () => [...sursaPerioada].sort((a, b) => (Number(b.incasare) || 0) - (Number(a.incasare) || 0)).slice(0, 10),
    [sursaPerioada]
  )

  const clasamentClienti = useMemo(() => {
    const map = new Map()
    for (const l of sursaPerioada) {
      const cheie = (modGrupare === 'medic' ? l.medic : l.clinica) || '(fără nume)'
      map.set(cheie, (map.get(cheie) || 0) + (Number(l.incasare) || 0))
    }
    return Array.from(map.entries())
      .map(([nume, total]) => ({ nume, total }))
      .sort((a, b) => b.total - a.total)
  }, [sursaPerioada, modGrupare])

  return (
    <div className="financiar-prezentare">
      <div className="financiar-luna-nav">
        <button type="button" className="btn btn-secondary financiar-luna-btn" onClick={() => schimbaLuna(-1)} aria-label="Luna anterioară">
          ‹
        </button>
        <div className="financiar-luna-current">
          <span className="financiar-luna-label">{lunaLabel}</span>
          {!esteLunaCurenta && (
            <button type="button" className="btn btn-ghost financiar-luna-today" onClick={() => setLuna(lunaCurenta())}>
              Luna curentă
            </button>
          )}
        </div>
        <button type="button" className="btn btn-secondary financiar-luna-btn" onClick={() => schimbaLuna(1)} aria-label="Luna următoare">
          ›
        </button>
      </div>

      <div className="financiar-kpi-grid">
        <div className="card financiar-kpi-card">
          <span className="financiar-kpi-label">Total produs</span>
          <span className="financiar-kpi-value">{loading ? '—' : formatSuma(totalProdus)}</span>
        </div>
        <div className="card financiar-kpi-card">
          <span className="financiar-kpi-label">Total cheltuit</span>
          <span className="financiar-kpi-value">{loading ? '—' : formatSuma(totalCheltuit)}</span>
        </div>
        <div className={`card financiar-kpi-card financiar-kpi-profit ${profit >= 0 ? 'pozitiv' : 'negativ'}`}>
          <span className="financiar-kpi-label">Profit</span>
          <span className="financiar-kpi-value">{loading ? '—' : formatSuma(profit)}</span>
        </div>
      </div>

      {!loading && lucrariLunaSelectata.length === 0 && (
        <p className="financiar-status-text">Nicio lucrare arhivată în {lunaLabel.toLowerCase()}.</p>
      )}

      <div className="financiar-section-header">
        <h3>Statistici</h3>
        <div className="segmented financiar-perioada-toggle" role="group" aria-label="Perioadă">
          <button type="button" className={`segmented-option ${modPerioada === 'luna' ? 'active' : ''}`} onClick={() => setModPerioada('luna')}>
            Luna selectată
          </button>
          <button type="button" className={`segmented-option ${modPerioada === 'tot' ? 'active' : ''}`} onClick={() => setModPerioada('tot')}>
            Tot istoricul
          </button>
        </div>
      </div>

      <section className="card financiar-stat-card">
        <h4 className="financiar-stat-title">Top 10 lucrări — {perioadaLabel}</h4>
        {loading ? (
          <p className="financiar-status-text">Se încarcă…</p>
        ) : top10.length === 0 ? (
          <p className="financiar-status-text">Nicio lucrare arhivată în această perioadă.</p>
        ) : (
          <div className="financiar-table-wrap">
            <table className="financiar-table">
              <thead>
                <tr>
                  <th>Nr. înreg.</th>
                  <th>Pacient</th>
                  <th>Tip lucrare</th>
                  <th>Clinică / Medic</th>
                  <th>Valoare</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((l) => (
                  <tr key={l.id} className="financiar-table-row" onClick={() => onOpenLucrare?.(l)} tabIndex={0}>
                    <td className="financiar-table-nr">{l.nr_inregistrare}</td>
                    <td>{l.pacient || '—'}</td>
                    <td>{l.tip_lucrare}</td>
                    <td>{clientLabel(l)}</td>
                    <td className="financiar-table-suma">{formatSuma(l.incasare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card financiar-stat-card">
        <div className="financiar-stat-header">
          <h4 className="financiar-stat-title">Clasament clienți — {perioadaLabel}</h4>
          <div className="segmented financiar-grupare-toggle" role="group" aria-label="Grupare">
            <button type="button" className={`segmented-option ${modGrupare === 'clinica' ? 'active' : ''}`} onClick={() => setModGrupare('clinica')}>
              Clinică
            </button>
            <button type="button" className={`segmented-option ${modGrupare === 'medic' ? 'active' : ''}`} onClick={() => setModGrupare('medic')}>
              Medic
            </button>
          </div>
        </div>
        {loading ? (
          <p className="financiar-status-text">Se încarcă…</p>
        ) : clasamentClienti.length === 0 ? (
          <p className="financiar-status-text">Nicio lucrare arhivată în această perioadă.</p>
        ) : (
          <div className="financiar-table-wrap">
            <table className="financiar-table">
              <thead>
                <tr>
                  <th>{modGrupare === 'medic' ? 'Medic' : 'Clinică'}</th>
                  <th>Valoare totală</th>
                </tr>
              </thead>
              <tbody>
                {clasamentClienti.map((r) => (
                  <tr key={r.nume}>
                    <td>{r.nume}</td>
                    <td className="financiar-table-suma">{formatSuma(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
