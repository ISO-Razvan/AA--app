import { useCallback, useEffect, useState } from 'react'
import { getEtapeProductie, getTehnicieni, getProductieLucrare, setProductieAlocare } from '../services/dataService'
import { subscribeToTable } from '../services/realtime'
import { statusDinRanduri } from '../utils/statusLucrare'
import { azi } from '../utils/date'
import Dropdown from './Dropdown.jsx'
import DatePicker from './DatePicker.jsx'
import './ProductieTimeline.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

export default function ProductieTimeline({ lucrareId, dataIntrare, termenPredare }) {
  const [etape, setEtape] = useState([])
  const [tehnicieni, setTehnicieni] = useState([])
  const [randuri, setRanduri] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [e, t, r] = await Promise.all([getEtapeProductie(), getTehnicieni(), getProductieLucrare(lucrareId)])
      setEtape(e)
      setTehnicieni(t)
      setRanduri(r)
      setLoading(false)
    }
    load()
  }, [lucrareId])

  const reincarcaRanduri = useCallback(async () => {
    setRanduri(await getProductieLucrare(lucrareId))
  }, [lucrareId])

  // Realtime: dacă aceeași lucrare e deschisă în altă parte (Task-uri, altă
  // fereastră) și e bifată acolo, tabul Producție reflectă automat modificarea.
  useEffect(() => {
    const unsubscribe = subscribeToTable('productie_lucrare', () => reincarcaRanduri(), `lucrare_id=eq.${lucrareId}`)
    return unsubscribe
  }, [lucrareId, reincarcaRanduri])

  const randPentru = (etapaId) => randuri.find((r) => r.etapa_id === etapaId)

  // Etapa cu cea mai târzie dată planificată (dintre cele care au o dată
  // setată) — dacă acea dată depășește termenul de predare, semnalăm vizual,
  // strict informativ (nu blochează salvarea).
  const randuriCuData = randuri.filter((r) => r.data_planificata)
  const ultimaDataPlanificata =
    randuriCuData.length > 0
      ? randuriCuData.reduce((max, r) => (r.data_planificata > max ? r.data_planificata : max), randuriCuData[0].data_planificata)
      : null
  const depasesteTermenul = !!(ultimaDataPlanificata && termenPredare && ultimaDataPlanificata > termenPredare)

  const handlePatch = async (etapaId, patch) => {
    const updated = await setProductieAlocare(lucrareId, etapaId, patch)
    setRanduri((prev) => {
      const idx = prev.findIndex((r) => r.etapa_id === etapaId)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }

  if (loading) {
    return <p className="productie-loading">Se încarcă…</p>
  }

  const status = statusDinRanduri(etape.length, randuri)

  return (
    <div className="productie-timeline">
      {etape.length > 0 && (
        <div className="productie-status-row">
          <span className="field-label">Status lucrare</span>
          <span className={`badge ${status.badgeClass}`}>{status.label}</span>
        </div>
      )}

      <div className="productie-item productie-item-fix">
        <span className="productie-dot productie-dot-start" aria-hidden="true" />
        <div className="productie-content">
          <span className="productie-label">Data intrare</span>
          <p className="productie-value">{formatData(dataIntrare)}</p>
        </div>
      </div>

      {etape.length === 0 && (
        <p className="productie-empty">
          Nicio etapă de producție definită încă — adaugă etape din Setup → Etape de producție.
        </p>
      )}

      {etape.map((etapa) => {
        const rand = randPentru(etapa.id)
        const tehniciniPotriviti = tehnicieni.filter((t) => (t.roluri || []).includes(etapa.id))
        const asignat = !!(rand?.tehnician_id && rand?.data_planificata)
        const finalizat = !!rand?.finalizat
        const esteUltimaIntarziata =
          depasesteTermenul && rand?.data_planificata && rand.data_planificata === ultimaDataPlanificata
        // Etapa „Model" nu se alocă unui tehnician/dată din acest tab — se
        // afișează doar ca marcaj de stare pe cronologie (cuplat de numele
        // etapei, nu de un id stabil, pentru că etapele n-au un „tip" separat).
        const esteModel = etapa.nume === 'Model'
        return (
          <div className={`productie-item ${finalizat ? 'productie-item-finalizata' : ''}`} key={etapa.id}>
            <span
              className={`productie-dot ${finalizat ? 'productie-dot-finalizat' : asignat ? 'productie-dot-done' : ''}`}
              aria-hidden="true"
            >
              {finalizat && '✓'}
            </span>
            <div className="productie-content">
              <span className="productie-label">
                {etapa.nume}
                {finalizat && (
                  <span className="productie-finalizat-badge">
                    ✓ Finalizat{rand.data_finalizare ? ` pe ${formatData(rand.data_finalizare)}` : ''}
                  </span>
                )}
                {esteUltimaIntarziata && (
                  <span className="productie-depasire-badge">Depășește termenul de predare</span>
                )}
              </span>
              {esteModel ? (
                <label className="productie-model-checkbox">
                  <input
                    type="checkbox"
                    checked={finalizat}
                    onChange={() =>
                      handlePatch(etapa.id, {
                        finalizat: !finalizat,
                        data_finalizare: !finalizat ? azi() : null,
                      })
                    }
                  />
                  <span>Model finalizat</span>
                </label>
              ) : (
                <div className="productie-fields">
                  <div>
                    <label className="field-label">Alege tehnician</label>
                    <Dropdown
                      value={rand?.tehnician_id || ''}
                      onChange={(v) => handlePatch(etapa.id, { tehnician_id: v || null })}
                      options={tehniciniPotriviti.map((t) => ({ value: t.id, label: t.nume }))}
                      emptyLabel="— fără —"
                      placeholder="— fără —"
                    />
                    {tehniciniPotriviti.length === 0 && (
                      <p className="productie-hint">Niciun tehnician cu acest rol (Setup → Tehnicieni).</p>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Data planificată</label>
                    <DatePicker
                      value={rand?.data_planificata || ''}
                      onChange={(v) => handlePatch(etapa.id, { data_planificata: v })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <div className="productie-item productie-item-fix">
        <span className="productie-dot productie-dot-end" aria-hidden="true" />
        <div className="productie-content">
          <span className="productie-label">Termen predare</span>
          <p className="productie-value">{formatData(termenPredare)}</p>
          {depasesteTermenul && (
            <p className="productie-depasire-nota">
              Ultima etapă planificată ({formatData(ultimaDataPlanificata)}) depășește acest termen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
