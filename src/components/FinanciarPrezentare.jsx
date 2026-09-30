import { useEffect, useMemo, useState } from 'react'
import { getLucrari } from '../services/dataService'
import { azi } from '../utils/date'
import { formatSuma } from './SalariiPage.jsx'
import './FinanciarPrezentare.css'

const NUME_LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

// Valoarea din casetele de sus: rotunjită la leu, cu separator de mii (ex. 44.390).
function formatValoareCaseta(n) {
  return Math.round(Number(n) || 0).toLocaleString('ro-RO')
}

// Casetă cu o sumă — „RON" mereu pe rândul de sub valoare, oricât de lungă ar fi.
function CasetaKpi({ eticheta, valoare, nota, loading, className = '' }) {
  return (
    <div className={`card financiar-kpi-card ${className}`}>
      <span className="financiar-kpi-label">{eticheta}</span>
      <span className="financiar-kpi-value stat-value-lg">{loading ? '—' : formatValoareCaseta(valoare)}</span>
      <span className="financiar-kpi-moneda">RON</span>
      <span className="financiar-kpi-nota">{nota}</span>
    </div>
  )
}

function lunaCurenta() {
  const [an, luna] = azi().split('-')
  return { an: Number(an), luna: Number(luna) }
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

  // Toate sumele vin din instantaneul financiar al fiecărei lucrări
  // (incasare / cost_laborator / comisioane, cu extra-urile și Try-in-ul deja
  // incluse în incasare și cost_laborator).
  const suma = (lista, camp) => lista.reduce((s, l) => s + (Number(l[camp]) || 0), 0)
  const sumaComisioane = (lista) =>
    lista.reduce((s, l) => s + (l.comisioane || []).reduce((t, c) => t + (Number(c.suma) || 0), 0), 0)

  // Lucrările intrate în luna selectată (după data intrării) — toate, oricare
  // le-ar fi statusul sau dacă sunt arhivate.
  const lucrariIntrateLuna = useMemo(
    () => lucrari.filter((l) => (l.data_intrare || '').slice(0, 7) === lunaPrefix),
    [lucrari, lunaPrefix]
  )
  // Lucrările arhivate în luna selectată (după data arhivării).
  const lucrariArhivateLuna = useMemo(
    () => lucrari.filter((l) => l.arhivat && (l.data_arhivare || '').slice(0, 7) === lunaPrefix),
    [lucrari, lunaPrefix]
  )

  const valoareIntrate = suma(lucrariIntrateLuna, 'incasare')
  const valoareFinalizate = suma(lucrariArhivateLuna, 'incasare')
  const cheltuieliEstimate = suma(lucrariIntrateLuna, 'cost_laborator')
  // Toate comisioanele din instantaneu, bifate sau nu — o estimare; suma
  // reală de plată rămâne cea din Salarii (doar etapele bifate).
  const salariiEstimate = sumaComisioane(lucrariIntrateLuna)
  const profitEstimat = valoareIntrate - cheltuieliEstimate - salariiEstimate

  const sursaPerioada = modPerioada === 'luna' ? lucrariIntrateLuna : lucrari
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
        <CasetaKpi
          eticheta="Valoare lucrări intrate"
          valoare={valoareIntrate}
          loading={loading}
          nota={`${lucrariIntrateLuna.length} ${lucrariIntrateLuna.length === 1 ? 'lucrare intrată' : 'lucrări intrate'} în lună`}
        />
        <CasetaKpi
          eticheta="Valoare lucrări finalizate"
          valoare={valoareFinalizate}
          loading={loading}
          nota={`${lucrariArhivateLuna.length} ${lucrariArhivateLuna.length === 1 ? 'lucrare arhivată' : 'lucrări arhivate'} în lună`}
        />
        <CasetaKpi
          eticheta="Cheltuieli estimate"
          valoare={cheltuieliEstimate}
          loading={loading}
          nota="costul de laborator al lucrărilor intrate"
        />
        <CasetaKpi
          eticheta="Salarii estimate"
          valoare={salariiEstimate}
          loading={loading}
          nota="toate comisioanele lucrărilor intrate"
        />
        <CasetaKpi
          eticheta="Profit estimat"
          valoare={profitEstimat}
          loading={loading}
          nota="intrate − cheltuieli − salarii estimate"
          className={`financiar-kpi-profit ${profitEstimat >= 0 ? 'pozitiv' : 'negativ'}`}
        />
      </div>

      <p className="financiar-status-text">
        „Estimat" = calculat din lucrările <strong>intrate</strong> în {lunaLabel.toLowerCase()} (după data intrării),
        nu neapărat finalizate sau plătite. Salariile reale de plată sunt cele din Salarii, unde contează doar etapele
        bifate. „Finalizate" = lucrările arhivate în lună.
      </p>

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
          <p className="financiar-status-text">Nicio lucrare intrată în această perioadă.</p>
        ) : (
          <div className="financiar-table-wrap">
            <table className="financiar-table">
              <thead>
                <tr>
                  <th>Pacient</th>
                  <th>Medic</th>
                  <th>Tip lucrare</th>
                  <th>Nr. înreg.</th>
                  <th>Clinică</th>
                  <th>Valoare</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((l) => (
                  <tr key={l.id} className="financiar-table-row" onClick={() => onOpenLucrare?.(l)} tabIndex={0}>
                    <td className="rezumat-pacient">{l.pacient || '—'}</td>
                    <td className="rezumat-medic">{l.medic || '—'}</td>
                    <td className="rezumat-tip">{l.tip_lucrare}</td>
                    <td className="financiar-table-nr">{l.nr_inregistrare}</td>
                    <td>{l.clinica || '—'}</td>
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
          <p className="financiar-status-text">Nicio lucrare intrată în această perioadă.</p>
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
