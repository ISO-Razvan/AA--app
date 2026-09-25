import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSalariulMeu } from '../services/dataService'
import { azi } from '../utils/date'
import { formatSuma } from './SalariiPage.jsx'
import { SalariuDetaliuContinut } from './SalariiDetaliuModal.jsx'
import './SalariiPage.css'

const NUME_LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

function lunaCurenta() {
  const [an, luna] = azi().split('-')
  return { an: Number(an), luna: Number(luna) }
}

// Comisioanele tehnicianului logat, pe lună — din RPC-ul `salariul_meu`,
// care întoarce doar etapele finalizate ale lui (identificat în baza de date
// din sesiune), nu datele altor tehnicieni.
export default function SalariulMeuPage() {
  const navigate = useNavigate()
  const [luna, setLuna] = useState(lunaCurenta)
  const [randuri, setRanduri] = useState([])
  const [loading, setLoading] = useState(true)
  const [eroare, setEroare] = useState('')

  const lunaPrefix = `${luna.an}-${String(luna.luna).padStart(2, '0')}`
  const esteLunaCurenta = lunaPrefix === azi().slice(0, 7)
  const lunaLabel = `${NUME_LUNI[luna.luna - 1]} ${luna.an}`

  useEffect(() => {
    let activ = true
    setLoading(true)
    setEroare('')
    getSalariulMeu(lunaPrefix)
      .then((date) => {
        if (activ) setRanduri(date)
      })
      .catch((err) => {
        if (activ) setEroare(err.message)
      })
      .finally(() => {
        if (activ) setLoading(false)
      })
    return () => {
      activ = false
    }
  }, [lunaPrefix])

  // Același format ca în fereastra de detaliu din Salarii.
  const randuriDetaliu = useMemo(
    () =>
      randuri.map((r) => ({
        alocare: { id: `${r.lucrare_id}-${r.etapa_id}`, data_finalizare: r.data_finalizare },
        lucrare: {
          id: r.lucrare_id,
          nr_inregistrare: r.nr_inregistrare,
          medic: r.medic,
          pacient: r.pacient,
          tip_lucrare: r.tip_lucrare,
          nr_elemente: r.nr_elemente,
        },
        etapa: r.etapa_id ? { id: r.etapa_id, nume: r.etapa_nume, ordine: r.etapa_ordine } : null,
        suma: Number(r.suma) || 0,
      })),
    [randuri]
  )

  const total = randuriDetaliu.reduce((s, r) => s + r.suma, 0)

  const schimbaLuna = (delta) => {
    setLuna((prev) => {
      let l = prev.luna + delta
      let a = prev.an
      if (l < 1) { l = 12; a -= 1 }
      if (l > 12) { l = 1; a += 1 }
      return { an: a, luna: l }
    })
  }

  return (
    <div className="salarii-page">
      <h2>Salariul meu</h2>
      <p className="salarii-page-hint">Comisioanele tale din etapele finalizate, pe lună.</p>

      <div className="salarii-luna-nav">
        <button type="button" className="btn btn-secondary salarii-luna-btn" onClick={() => schimbaLuna(-1)} aria-label="Luna anterioară">
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
        <button type="button" className="btn btn-secondary salarii-luna-btn" onClick={() => schimbaLuna(1)} aria-label="Luna următoare">
          ›
        </button>
      </div>

      <div className="card salarii-total-card">
        <span className="salarii-total-label">Comisionul tău în {lunaLabel}</span>
        <span className="salarii-total-value stat-value-lg">{loading ? '—' : formatSuma(total)}</span>
      </div>

      {loading ? (
        <p className="salarii-status-text">Se încarcă…</p>
      ) : eroare ? (
        <div className="card salarii-empty">
          <p>{eroare}</p>
        </div>
      ) : (
        <div className="card salarii-detaliu-sectiuni">
          <SalariuDetaliuContinut
            randuri={randuriDetaliu}
            onOpenLucrare={(l) => navigate(`/comanda/${encodeURIComponent(l.nr_inregistrare)}`)}
          />
        </div>
      )}
    </div>
  )
}
