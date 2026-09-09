import { useEffect, useMemo, useState } from 'react'
import { getTehnicieni, getToateAlocarile, getLucrari, getEtapeProductie } from '../services/dataService'
import { azi } from '../utils/date'
import SalariiDetaliuModal from './SalariiDetaliuModal.jsx'
import './SalariiPage.css'

const NUME_LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

function lunaCurenta() {
  const [an, luna] = azi().split('-')
  return { an: Number(an), luna: Number(luna) }
}

export function formatSuma(n) {
  return `${(Number(n) || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`
}

export default function SalariiPage({ onOpenLucrare }) {
  const [luna, setLuna] = useState(lunaCurenta)
  const [tehnicieni, setTehnicieni] = useState([])
  const [alocari, setAlocari] = useState([])
  const [lucrari, setLucrari] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [tehnicianDeschis, setTehnicianDeschis] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, a, l, e] = await Promise.all([
        getTehnicieni(),
        getToateAlocarile(),
        getLucrari(),
        getEtapeProductie(),
      ])
      setTehnicieni(t)
      setAlocari(a)
      setLucrari(l)
      setEtape(e)
      setLoading(false)
    }
    load()
  }, [])

  const lunaPrefix = `${luna.an}-${String(luna.luna).padStart(2, '0')}`
  const esteLunaCurenta = lunaPrefix === azi().slice(0, 7)

  const schimbaLuna = (delta) => {
    setLuna((prev) => {
      let l = prev.luna + delta
      let a = prev.an
      if (l < 1) { l = 12; a -= 1 }
      if (l > 12) { l = 1; a += 1 }
      return { an: a, luna: l }
    })
  }

  const lucrareById = (id) => lucrari.find((l) => l.id === id)
  const etapaById = (id) => etape.find((e) => e.id === id)

  const sumaComisionAlocare = (alocare) => {
    const lucrare = lucrareById(alocare.lucrare_id)
    if (!lucrare) return 0
    const comision = (lucrare.comisioane || []).find((c) => c.etapa_id === alocare.etapa_id)
    return Number(comision?.suma) || 0
  }

  const alocariLuna = useMemo(
    () => alocari.filter((a) => a.finalizat && a.data_finalizare && a.data_finalizare.startsWith(lunaPrefix)),
    [alocari, lunaPrefix]
  )

  const randuriTehnicieni = useMemo(() => {
    return tehnicieni.map((t) => {
      const alocariTehnician = alocariLuna.filter((a) => a.tehnician_id === t.id)
      const total = alocariTehnician.reduce((sum, a) => sum + sumaComisionAlocare(a), 0)
      return { tehnician: t, count: alocariTehnician.length, total }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })
  }, [tehnicieni, alocariLuna, lucrari])

  const totalGeneral = randuriTehnicieni.reduce((sum, r) => sum + r.total, 0)

  const detaliiTehnician = useMemo(() => {
    if (!tehnicianDeschis) return []
    return alocariLuna
      .filter((a) => a.tehnician_id === tehnicianDeschis.id)
      .map((a) => ({
        alocare: a,
        lucrare: lucrareById(a.lucrare_id),
        etapa: etapaById(a.etapa_id),
        suma: sumaComisionAlocare(a),
      }))
      .filter((r) => r.lucrare)
      .sort((x, y) => (y.alocare.data_finalizare || '').localeCompare(x.alocare.data_finalizare || ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tehnicianDeschis, alocariLuna, lucrari, etape])

  const lunaLabel = `${NUME_LUNI[luna.luna - 1]} ${luna.an}`
  const niciunComisionConfigurat = totalGeneral === 0 && alocariLuna.length > 0

  return (
    <div className="salarii-page">
      <h2>Salarii</h2>
      <p className="salarii-page-hint">Comisioane câștigate de fiecare tehnician, pe lună.</p>

      <div className="salarii-luna-nav">
        <button
          type="button"
          className="btn btn-secondary salarii-luna-btn"
          onClick={() => schimbaLuna(-1)}
          aria-label="Luna anterioară"
        >
          ‹
        </button>
        <div className="salarii-luna-current">
          <span className="salarii-luna-label">{lunaLabel}</span>
          {!esteLunaCurenta && (
            <button type="button" className="btn btn-ghost salarii-luna-today" onClick={() => setLuna(lunaCurenta())}>
              Luna curentă
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary salarii-luna-btn"
          onClick={() => schimbaLuna(1)}
          aria-label="Luna următoare"
        >
          ›
        </button>
      </div>

      <div className="card salarii-total-card">
        <span className="salarii-total-label">Total plătit tehnicienilor în {lunaLabel}</span>
        <span className="salarii-total-value">{loading ? '—' : formatSuma(totalGeneral)}</span>
      </div>

      {loading ? (
        <p className="salarii-status-text">Se încarcă…</p>
      ) : tehnicieni.length === 0 ? (
        <div className="card salarii-empty">
          <p>Niciun tehnician înregistrat încă. Adaugă tehnicieni din Setup → Tehnicieni.</p>
        </div>
      ) : niciunComisionConfigurat ? (
        <div className="card salarii-empty salarii-empty-notice">
          <p>
            Există {alocariLuna.length} etape finalizate în {lunaLabel}, dar comisionul total e 0 lei — nu e o
            eroare, doar nicio sumă de comision nu era configurată în Setup → Comisioane la momentul înregistrării
            acestor lucrări.
          </p>
        </div>
      ) : (
        <div className="card salarii-table-wrap">
          <table className="salarii-table">
            <thead>
              <tr>
                <th>Tehnician</th>
                <th>Etape finalizate</th>
                <th>Comision total</th>
              </tr>
            </thead>
            <tbody>
              {randuriTehnicieni.map(({ tehnician, count, total }) => (
                <tr
                  key={tehnician.id}
                  className="salarii-table-row"
                  onClick={() => setTehnicianDeschis(tehnician)}
                  tabIndex={0}
                >
                  <td className="salarii-table-nume">{tehnician.nume}</td>
                  <td>{count}</td>
                  <td className="salarii-table-suma">{formatSuma(total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tehnicianDeschis && (
        <SalariiDetaliuModal
          tehnician={tehnicianDeschis}
          lunaLabel={lunaLabel}
          randuri={detaliiTehnician}
          onClose={() => setTehnicianDeschis(null)}
          onOpenLucrare={onOpenLucrare}
        />
      )}
    </div>
  )
}
