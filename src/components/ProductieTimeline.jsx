import { useCallback, useEffect, useState } from 'react'
import {
  getEtapeProductie,
  getTehnicieni,
  getProductieLucrare,
  setProductieAlocare,
  setFinalizareEtapa,
  updateLucrare,
} from '../services/dataService'
import { subscribeToTable } from '../services/realtime'
import { statusLucrare } from '../utils/statusLucrare'
import { configLivrare, esteEtapaModel, esteEtapaValidare, etapeAplicabile } from '../utils/etapaProductie'
import { candidatiEtapa } from '../utils/etapeNeplanificate'
import { azi } from '../utils/date'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './ProductieTimeline.css'

// Valoarea din selector pentru „toate etapele finalizate”.
const TOATE = '__toate__'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function formatDataOra(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Tehnicianul (esteAdmin = false) poate bifa doar etapele alocate lui
// (`tehnicianId`) — aceeași regulă e impusă și în baza de date.
export default function ProductieTimeline({
  lucrareId,
  dataIntrare,
  termenPredare,
  arhivat,
  dataArhivare,
  onArhivat,
  esteAdmin = false,
  tehnicianId = null,
}) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [etapeToate, setEtape] = useState([])
  const [tehnicieni, setTehnicieni] = useState([])
  const [randuri, setRanduri] = useState([])
  // Etapa Validare apare doar la lucrările cărora li se aplică (trimise la validare sau cu rând pentru ea).
  const etape = etapeAplicabile(etapeToate, randuri)
  const [loading, setLoading] = useState(true)
  const [recuperare, setRecuperare] = useState(false)

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

  const poateBifa = (rand) => !arhivat && (esteAdmin || (!!tehnicianId && rand?.tehnician_id === tehnicianId))

  const handleBifa = async (etapaId, finalizat) => {
    const rand = randPentru(etapaId)
    if (!poateBifa(rand)) return
    // Pe un rând existent — doar bifa (singura scriere permisă tehnicianului);
    // o etapă fără rând încă (ex. „Model") o poate bifa doar adminul.
    const updated = rand
      ? await setFinalizareEtapa(lucrareId, etapaId, finalizat)
      : await setProductieAlocare(lucrareId, etapaId, { finalizat, data_finalizare: finalizat ? azi() : null })
    setRanduri((prev) => {
      const idx = prev.findIndex((r) => r.etapa_id === etapaId)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }

  // Mutare manuală, în ambele sensuri și fără restricții: „Lucrarea este acum la etapa X"
  // bifează ca finalizate toate etapele dinaintea lui X (cu data de azi) și debifează X și
  // cele de după (dacă erau bifate). Alegerea „Finalizată" bifează totul. Scrie prin
  // `setProductieAlocare` (doar coloanele date), deci tehnicianul alocat rămâne. Ordinea
  // contează: întâi bifările, apoi debifările (bifarea Design-ului completează singură
  // Validarea, iar dacă ținta e chiar Validarea, debifarea ei trebuie să vină ultima).
  const handleRecuperare = async (valoare) => {
    const indexTinta = valoare === TOATE ? etape.length : etape.findIndex((e) => e.id === valoare)
    if (indexTinta < 0) return
    const deBifat = etape.slice(0, indexTinta).filter((e) => !randPentru(e.id)?.finalizat)
    const deDebifat = etape.slice(indexTinta).filter((e) => randPentru(e.id)?.finalizat)
    const nl = String.fromCharCode(10)
    const tinta = valoare === TOATE ? 'Finalizată' : etape[indexTinta].nume
    if (deBifat.length === 0 && deDebifat.length === 0) {
      await confirm(`Lucrarea este deja la „${tinta}” — nu e nimic de schimbat.`, {
        title: 'Nimic de actualizat',
        confirmLabel: 'Închide',
        cancelLabel: 'Anulează',
      })
      return
    }
    const mesaj = [
      `Lucrarea va fi mutată la „${tinta}”.`,
      ...(deBifat.length ? ['', `Se bifează ca finalizate, cu data de azi (${formatData(azi())}):`, ...deBifat.map((e) => `• ${e.nume}`)] : []),
      ...(deDebifat.length ? ['', 'Se debifează (devin nefinalizate):', ...deDebifat.map((e) => `• ${e.nume}`)] : []),
      ...([...deBifat, ...deDebifat].some((e) => randPentru(e.id)?.tehnician_id)
        ? ['', 'Etapele cu tehnician alocat se schimbă și la Salarii (luna bifării, respectiv dispar din luna în care erau).']
        : []),
    ].join(nl)
    const ok = await confirm(mesaj, { title: 'Muți lucrarea la altă etapă?', confirmLabel: 'Mută lucrarea' })
    if (!ok) return
    setRecuperare(true)
    try {
      const data = azi()
      for (const e of deBifat) await setProductieAlocare(lucrareId, e.id, { finalizat: true, data_finalizare: data })
      for (const e of deDebifat) await setProductieAlocare(lucrareId, e.id, { finalizat: false, data_finalizare: null })
      await reincarcaRanduri()
    } finally {
      setRecuperare(false)
    }
  }

  // Admin: alege tehnicianul și/sau data planificată a unei etape direct din fișă
  // (scrie doar coloanele schimbate; bifa și celelalte câmpuri rămân neatinse).
  const handleAlocare = async (etapaId, patch) => {
    const updated = await setProductieAlocare(lucrareId, etapaId, patch)
    setRanduri((prev) => {
      const idx = prev.findIndex((r) => r.etapa_id === etapaId)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }

  const toateFinalizate = etape.length > 0 && etape.every((e) => !!randPentru(e.id)?.finalizat)

  const handleArhiveaza = async () => {
    const ok = await confirm(
      'Lucrarea nu va mai apărea în Dashboard, Kanban, Task-uri sau Capacitate — rămâne disponibilă doar din Listă lucrări → Arhivate, needitabilă până o scoți din arhivă.',
      { title: 'Arhivezi acest caz?', confirmLabel: 'Arhivează' }
    )
    if (!ok) return
    await updateLucrare(lucrareId, { arhivat: true, data_arhivare: new Date().toISOString() })
    await onArhivat?.()
  }

  const handleScoateDinArhiva = async () => {
    const ok = await confirm(
      'Va redeveni editabilă și va reapărea în Dashboard, Kanban, Task-uri și Capacitate.',
      { title: 'Scoți lucrarea din arhivă?', confirmLabel: 'Scoate din arhivă' }
    )
    if (!ok) return
    await updateLucrare(lucrareId, { arhivat: false, data_arhivare: null })
    await onArhivat?.()
  }

  if (loading) {
    return (
      <>
        <p className="productie-loading">Se încarcă…</p>
        {confirmDialog}
      </>
    )
  }

  const status = statusLucrare(etape, randuri)
  const livrare = configLivrare(etape, tehnicieni)
  const livrareAutoId = livrare.automata ? livrare.etapa.id : null

  return (
    <div className="productie-timeline">
      {etape.length > 0 && (
        <div className="productie-status-row">
          <span className="field-label">Status lucrare</span>
          <span className={`badge ${status.badgeClass}`}>{status.label}</span>
        </div>
      )}

      {esteAdmin && !arhivat && etape.length > 1 && (
        <div className="productie-recuperare">
          <label className="field-label" htmlFor="productie-recuperare-select">
            Lucrarea este acum la etapa:
          </label>
          <select
            id="productie-recuperare-select"
            className="productie-recuperare-select"
            value=""
            disabled={recuperare}
            onChange={(e) => {
              if (e.target.value) handleRecuperare(e.target.value)
            }}
          >
            <option value="">Alege etapa…</option>
            {etape.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nume}
              </option>
            ))}
            <option value={TOATE}>Finalizată (toate etapele)</option>
          </select>
          <p className="productie-hint">Etapele dinaintea celei alese se bifează, iar cea aleasă și cele de după se debifează. Poți merge înainte sau înapoi.</p>
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
        const tehnicianAlocat = tehnicieni.find((t) => t.id === rand?.tehnician_id)
        const asignat = !!(rand?.tehnician_id && rand?.data_planificata)
        const finalizat = !!rand?.finalizat
        const esteUltimaIntarziata =
          depasesteTermenul && rand?.data_planificata && rand.data_planificata === ultimaDataPlanificata
        // Etapa „Model" nu se alocă unui tehnician/dată din acest tab — se
        // afișează doar ca marcaj de stare pe cronologie (cuplat de numele
        // etapei, nu de un id stabil, pentru că etapele n-au un „tip" separat).
        const esteModel = esteEtapaModel(etapa)
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
                <label className={`productie-checkbox ${!poateBifa(rand) ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={finalizat}
                    disabled={!poateBifa(rand)}
                    onChange={() => handleBifa(etapa.id, !finalizat)}
                  />
                  <span>Finalizat</span>
                </label>
              ) : (
                <>
                  <div className="productie-fields">
                    <div>
                      <span className="field-label">Tehnician alocat</span>
                      {esteAdmin && !arhivat && !esteEtapaValidare(etapa) ? (
                        <select
                          className="productie-recuperare-select"
                          aria-label={`Tehnician pentru ${etapa.nume}`}
                          value={rand?.tehnician_id || ''}
                          onChange={(e) => handleAlocare(etapa.id, { tehnician_id: e.target.value || null })}
                        >
                          <option value="">— neplanificat —</option>
                          {candidatiEtapa(etapa, rand, tehnicieni).map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nume}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="productie-value">{tehnicianAlocat?.nume || '— neplanificat —'}</p>
                      )}
                    </div>
                    <div>
                      <span className="field-label">Data planificată</span>
                      {esteAdmin && !arhivat && !esteEtapaValidare(etapa) && etapa.id !== livrareAutoId ? (
                        <input
                          type="date"
                          className="productie-recuperare-select"
                          aria-label={`Data planificată pentru ${etapa.nume}`}
                          value={rand?.data_planificata || ''}
                          onChange={(e) => handleAlocare(etapa.id, { data_planificata: e.target.value || null })}
                        />
                      ) : (
                        <p className="productie-value">{formatData(rand?.data_planificata)}</p>
                      )}
                    </div>
                  </div>
                  {etapa.id === livrareAutoId && <p className="productie-din-termen">din termenul de predare</p>}
                  <label className={`productie-checkbox productie-checkbox-etapa ${!poateBifa(rand) ? 'disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={finalizat}
                      disabled={!poateBifa(rand)}
                      onChange={() => handleBifa(etapa.id, !finalizat)}
                    />
                    <span>Finalizat</span>
                  </label>
                  {finalizat && !rand?.tehnician_id && (
                    <p className="productie-checkbox-warning">Bifat fără tehnician ales.</p>
                  )}
                </>
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

      {esteAdmin && etape.length > 0 && (
        <div className="productie-arhivare">
          {arhivat ? (
            <>
              <p className="productie-arhivare-status">
                ✓ Lucrare arhivată{dataArhivare ? ` pe ${formatDataOra(dataArhivare)}` : ''}.
              </p>
              <button
                type="button"
                className="btn btn-ghost productie-dezarhiveaza-btn"
                onClick={handleScoateDinArhiva}
              >
                Scoate din arhivă
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary productie-arhivare-btn"
                onClick={handleArhiveaza}
                disabled={!toateFinalizate}
              >
                Finalizează și arhivează cazul
              </button>
              {!toateFinalizate && (
                <p className="productie-hint">Toate etapele trebuie finalizate înainte de arhivare.</p>
              )}
            </>
          )}
        </div>
      )}

      {confirmDialog}
    </div>
  )
}
