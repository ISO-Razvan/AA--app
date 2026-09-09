import { useCallback, useEffect, useMemo, useState } from 'react'
import { getEtapeProductie, getToateAlocarile } from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { statusDinRanduri } from '../utils/statusLucrare'
import { etapaCurentaPentru } from '../utils/etapaProductie'
import { subscribeToTable } from '../services/realtime'
import './Dashboard.css'

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

function KpiCard({ label, value, tone }) {
  return (
    <div className={`card kpi-card kpi-card-${tone}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </div>
  )
}

function StatRow({ label, count, max, accent }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="dashboard-stat-row">
      <span className="dashboard-stat-label">{label}</span>
      <div className="dashboard-stat-bar-track">
        <div className={`dashboard-stat-bar-fill dashboard-stat-bar-${accent}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="dashboard-stat-count">{count}</span>
    </div>
  )
}

export default function Dashboard({ lucrari: toateLucrarile, loading, onOpenLucrare }) {
  // O lucrare arhivată dispare din Dashboard (KPI-uri, listă, grafice) — vezi
  // modul „Arhivate" din Listă lucrări pentru consultare ulterioară.
  const lucrari = useMemo(() => toateLucrarile.filter((l) => !l.arhivat), [toateLucrarile])
  const [etape, setEtape] = useState([])
  const [alocari, setAlocari] = useState([])

  const load = useCallback(async () => {
    const [etapeData, toateAlocarile] = await Promise.all([getEtapeProductie(), getToateAlocarile()])
    setEtape(etapeData)
    setAlocari(toateAlocarile)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: o etapă bifată/debifată de altcineva (Task-uri, Producție)
  // actualizează KPI-urile și graficele fără refresh manual.
  useEffect(() => {
    const unsubscribe = subscribeToTable('productie_lucrare', () => load())
    return unsubscribe
  }, [load])

  const statusPentru = (lucrareId) =>
    statusDinRanduri(etape.length, alocari.filter((a) => a.lucrare_id === lucrareId))

  const { activeCount, urgenteCount, sePredauAzi, intarziateCount } = useMemo(() => {
    const astazi = azi()
    const pragUrgent = adaugaZile(astazi, 2)
    let urgente = 0
    let intarziate = 0
    const azi_ = []

    for (const l of lucrari) {
      const status = statusPentru(l.id)
      const finalizat = status.id === 'finalizat'
      if (l.termen_predare) {
        if (!finalizat && l.termen_predare <= pragUrgent) urgente++
        if (!finalizat && l.termen_predare < astazi) intarziate++
        if (l.termen_predare === astazi) azi_.push(l)
      }
    }

    return { activeCount: lucrari.length, urgenteCount: urgente, sePredauAzi: azi_, intarziateCount: intarziate }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lucrari, alocari, etape])

  const etapeStats = useMemo(() => {
    if (etape.length === 0) return []
    const counts = Object.fromEntries(etape.map((e) => [e.id, 0]))
    let finalizate = 0
    for (const l of lucrari) {
      const randuriLucrare = alocari.filter((a) => a.lucrare_id === l.id)
      const { etapa } = etapaCurentaPentru(etape, randuriLucrare)
      if (etapa) counts[etapa.id]++
      else finalizate++
    }
    return [
      ...etape.map((e) => ({ id: e.id, nume: e.nume, count: counts[e.id] })),
      { id: '__finalizat__', nume: 'Finalizat', count: finalizate },
    ]
  }, [lucrari, alocari, etape])

  const tipuriStats = useMemo(() => {
    const counts = {}
    for (const l of lucrari) {
      const tip = l.tip_lucrare || 'Fără tip'
      counts[tip] = (counts[tip] || 0) + 1
    }
    return Object.entries(counts)
      .map(([nume, count]) => ({ nume, count }))
      .sort((a, b) => b.count - a.count)
  }, [lucrari])

  const maxEtapa = Math.max(1, ...etapeStats.map((s) => s.count))
  const maxTip = Math.max(1, ...tipuriStats.map((s) => s.count))

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <p className="dashboard-hint">Prezentare generală a lucrărilor din laborator.</p>

      <div className="dashboard-kpis">
        <KpiCard label="Lucrări active" value={loading ? '—' : activeCount} tone="neutral" />
        <KpiCard label="Urgente" value={loading ? '—' : urgenteCount} tone="warning" />
        <KpiCard label="Se predau azi" value={loading ? '—' : sePredauAzi.length} tone="neutral" />
        <KpiCard label="Întârziate" value={loading ? '—' : intarziateCount} tone="danger" />
      </div>

      <section className="card dashboard-azi-card">
        <h3 className="dashboard-section-title">Se predau azi</h3>

        {loading ? (
          <p className="dashboard-status-text">Se încarcă…</p>
        ) : sePredauAzi.length === 0 ? (
          <p className="dashboard-status-text">Nimic de predat azi.</p>
        ) : (
          <ul className="dashboard-azi-list">
            {sePredauAzi.map((l) => {
              const status = statusPentru(l.id)
              return (
                <li key={l.id}>
                  <button type="button" className="dashboard-azi-row" onClick={() => onOpenLucrare(l)}>
                    <span className="dashboard-azi-nr">{l.nr_inregistrare}</span>
                    <span className="dashboard-azi-pacient">{l.pacient || '—'}</span>
                    <span className="dashboard-azi-client">{clientLabel(l)}</span>
                    <span className="dashboard-azi-tip">{l.tip_lucrare}</span>
                    <span className={`badge ${status.badgeClass}`}>{status.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="dashboard-stats-grid">
        <section className="card dashboard-stats-card">
          <h3 className="dashboard-section-title">Lucrări pe etape</h3>
          {loading ? (
            <p className="dashboard-status-text">Se încarcă…</p>
          ) : etapeStats.length === 0 ? (
            <p className="dashboard-status-text">
              Nicio etapă de producție definită încă — adaugă etape din Setup → Etape de producție.
            </p>
          ) : (
            <div className="dashboard-stat-list">
              {etapeStats.map((s) => (
                <StatRow key={s.id} label={s.nume} count={s.count} max={maxEtapa} accent="blue" />
              ))}
            </div>
          )}
        </section>

        <section className="card dashboard-stats-card">
          <h3 className="dashboard-section-title">Lucrări pe tip</h3>
          {loading ? (
            <p className="dashboard-status-text">Se încarcă…</p>
          ) : tipuriStats.length === 0 ? (
            <p className="dashboard-status-text">Nicio lucrare înregistrată încă.</p>
          ) : (
            <div className="dashboard-stat-list">
              {tipuriStats.map((s) => (
                <StatRow key={s.nume} label={s.nume} count={s.count} max={maxTip} accent="purple" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
