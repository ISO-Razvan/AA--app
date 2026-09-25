import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  getTehnicieni,
  getEtapeProductie,
  getLucrari,
  getToateAlocarile,
  setProductieAlocare,
  updateLucrare,
} from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { configLivrare } from '../utils/etapaProductie'
import { subscribeToTable } from '../services/realtime'
import { useConfirm } from '../hooks/useConfirm.jsx'
import TaskuriZiModal from './TaskuriZiModal.jsx'
import DeschideFisaButton from './DeschideFisaButton.jsx'
import './TaskuriPage.css'

const NEPLANIFICATE_ID = '__neplanificate__'
const NUME_ZILE = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

function initiale(nume) {
  return (nume || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
}

function zileleSaptamanii(offsetSaptamani) {
  const d = new Date()
  const zi = d.getDay() // 0=Duminică..6=Sâmbătă
  const diffLaLuni = zi === 0 ? -6 : 1 - zi
  const luniAzi = adaugaZile(azi(), diffLaLuni + offsetSaptamani * 7)
  return Array.from({ length: 7 }, (_, i) => adaugaZile(luniAzi, i))
}

function formatZiScurt(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  return `${zi}.${luna}.${an}`
}

function formatIntervalSaptamana(zile) {
  const prima = new Date(`${zile[0]}T00:00:00`)
  const ultima = new Date(`${zile[6]}T00:00:00`)
  const primaStr = prima.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
  const ultimaStr = ultima.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${primaStr} – ${ultimaStr}`
}

// Zonă de „drop" — coloana unei zile din calendar, sau panoul „Lucrări
// neplanificate". `id` e fie o dată ISO, fie NEPLANIFICATE_ID.
function DropZone({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'taskuri-drop-over' : ''}`}>
      {children}
    </div>
  )
}

// Card tras — folosit atât pentru „Lucrări neplanificate", cât și pentru
// task-urile deja planificate din calendar. Click simplu (fără deplasare
// peste pragul de activare al senzorului) tot deschide fișa lucrării.
// `disabled` blochează și tragerea, și click-ul (folosit cât timp scrierea
// e în curs); `dragDisabled` blochează DOAR tragerea (pe mobil, unde
// reprogramarea se face din modalul de zi) — cardul rămâne apăsabil.
function DraggableTaskCard({ dragId, data, disabled, dragDisabled, onOpen, className, title, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data,
    disabled: disabled || dragDisabled,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={title}
      className={`${className} ${isDragging ? 'taskuri-task-card-dragging' : ''}`}
    >
      <button type="button" className="taskuri-task-open" onClick={onOpen} disabled={disabled}>
        {children}
      </button>
      <DeschideFisaButton className="taskuri-task-fisa" onClick={onOpen} />
    </div>
  )
}

function titluCard(lucrare) {
  return [
    `Pacient: ${lucrare.pacient || '—'}`,
    `Medic: ${lucrare.medic || '—'}`,
    `Tip lucrare: ${lucrare.tip_lucrare || '—'}`,
    `Clinică: ${lucrare.clinica || '—'}`,
    lucrare.nr_inregistrare,
  ].join('\n')
}

export default function TaskuriPage() {
  const navigate = useNavigate()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [tehnicieni, setTehnicieni] = useState([])
  const [etape, setEtape] = useState([])
  const [lucrari, setLucrari] = useState([])
  const [alocari, setAlocari] = useState([])
  const [loading, setLoading] = useState(true)
  const [tehnicianSelectat, setTehnicianSelectat] = useState(null)
  const [saptamanaOffset, setSaptamanaOffset] = useState(0)
  const [mutandKey, setMutandKey] = useState(null)
  const [ziModalDeschisa, setZiModalDeschisa] = useState(null)
  // Sub acest prag, calendarul arată o singură zi odată (fără drag & drop —
  // reprogramarea se face din modalul de zi, prin editare directă).
  const [isMobil, setIsMobil] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  // Index în săptămână (0=Luni..6=Duminică) al zilei arătate pe mobil —
  // implicit ziua de azi, indiferent de săptămâna vizibilă (rămâne aceeași
  // „poziție" în săptămână când navighezi înainte/înapoi cu săptămâna).
  const [ziAfisataMobil, setZiAfisataMobil] = useState(() => {
    const ziSapt = new Date().getDay()
    return ziSapt === 0 ? 6 : ziSapt - 1
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e) => setIsMobil(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    setLoading(true)
    const [t, e, l, a] = await Promise.all([getTehnicieni(), getEtapeProductie(), getLucrari(), getToateAlocarile()])
    setTehnicieni(t)
    setEtape(e)
    setLucrari(l.filter((x) => !x.arhivat))
    setAlocari(a)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const reincarcaAlocarile = useCallback(async () => {
    setAlocari(await getToateAlocarile())
  }, [])

  const reincarcaLucrarile = useCallback(async () => {
    const l = await getLucrari()
    setLucrari(l.filter((x) => !x.arhivat))
  }, [])

  // Realtime — orice bifare/mutare venită de oriunde (Kanban, fișa lucrării,
  // altă sesiune) se reflectă automat aici, fără reîncărcare manuală.
  useEffect(() => {
    const unsub1 = subscribeToTable('productie_lucrare', () => reincarcaAlocarile())
    const unsub2 = subscribeToTable('lucrari', () => reincarcaLucrarile())
    return () => {
      unsub1()
      unsub2()
    }
  }, [reincarcaAlocarile, reincarcaLucrarile])

  useEffect(() => {
    if (tehnicianSelectat) {
      const proaspat = tehnicieni.find((t) => t.id === tehnicianSelectat.id)
      if (proaspat && proaspat !== tehnicianSelectat) setTehnicianSelectat(proaspat)
    }
  }, [tehnicieni, tehnicianSelectat])

  const zileSaptamana = useMemo(() => zileleSaptamanii(saptamanaOffset), [saptamanaOffset])
  const astazi = azi()
  const esteSaptamanaCurenta = saptamanaOffset === 0

  const etapaById = (id) => etape.find((e) => e.id === id)

  // Livrare planificată automat: data vine din termenul de predare (trigger
  // în baza de date), deci nu apare în „neplanificate", iar mutarea cardului
  // pe altă zi înseamnă mutarea termenului de predare.
  const livrareAutoId = useMemo(() => {
    const cfg = configLivrare(etape, tehnicieni)
    return cfg.automata ? cfg.etapa.id : null
  }, [etape, tehnicieni])

  // Pentru fiecare rol al tehnicianului selectat, verificare directă per
  // etapă (fără nicio ordine/gating între etape, spre deosebire de Kanban,
  // care rămâne pe `etapaCurentaPentru` neschimbat): are lucrarea un rând în
  // `productie_lucrare` pentru (lucrare, acea etapă) cu tehnician+dată
  // completate? Dacă nu, etapa e nealocată. O lucrare cu mai multe etape
  // nealocate care se potrivesc TOATE cu rolurile tehnicianului selectat
  // apare într-un SINGUR element de listă, grupat — nu duplicat per etapă;
  // gruparea e complet dinamică, calculată din rolurile lui la momentul
  // afișării, fără nicio asociere fixă hardcodată între etape.
  const lucrariNeplanificate = useMemo(() => {
    if (!tehnicianSelectat) return []
    const roluri = tehnicianSelectat.roluri || []
    const rezultat = []
    for (const l of lucrari) {
      const etapeNealocate = []
      for (const etapaId of roluri) {
        const rand = alocari.find((a) => a.lucrare_id === l.id && a.etapa_id === etapaId)
        // Livrarea automată e neplanificată doar cât lucrarea n-are termen de
        // predare — plasarea ei în calendar setează termenul (vezi mutaTermenul).
        if (etapaId === livrareAutoId) {
          if (l.termen_predare || rand?.finalizat) continue
          const etapa = etape.find((e) => e.id === etapaId)
          if (etapa) etapeNealocate.push(etapa)
          continue
        }
        const asignat = !!(rand?.tehnician_id && rand?.data_planificata)
        if (asignat) continue
        const etapa = etape.find((e) => e.id === etapaId)
        if (!etapa) continue
        etapeNealocate.push(etapa)
      }
      if (etapeNealocate.length > 0) {
        rezultat.push({ lucrare: l, etape: etapeNealocate })
      }
    }
    return rezultat
  }, [lucrari, etape, alocari, tehnicianSelectat, livrareAutoId])

  // Task-urile tehnicianului selectat în săptămâna vizibilă, pe zi, cu o
  // singură căsuță per lucrare: toate etapele lui planificate pentru aceeași
  // lucrare în aceeași zi se grupează (oricare ar fi ele — gruparea vine din
  // alocările reale, nu din perechi de roluri fixe). Aceleași etape în zile
  // diferite rămân căsuțe separate.
  const taskuriPeZi = useMemo(() => {
    const map = Object.fromEntries(zileSaptamana.map((zi) => [zi, []]))
    if (!tehnicianSelectat) return map
    for (const a of alocari) {
      if (a.tehnician_id !== tehnicianSelectat.id) continue
      if (!a.data_planificata || !map[a.data_planificata]) continue
      const lucrare = lucrari.find((l) => l.id === a.lucrare_id)
      if (!lucrare) continue
      const grupuriZi = map[a.data_planificata]
      let grup = grupuriZi.find((g) => g.lucrare.id === lucrare.id)
      if (!grup) {
        grup = { cheie: `${lucrare.id}|${a.data_planificata}`, lucrare, alocari: [] }
        grupuriZi.push(grup)
      }
      grup.alocari.push(a)
    }
    for (const grupuriZi of Object.values(map)) {
      for (const g of grupuriZi) {
        g.etapaIds = g.alocari.map((a) => a.etapa_id)
        g.finalizat = g.alocari.every((a) => a.finalizat)
      }
    }
    return map
  }, [alocari, lucrari, tehnicianSelectat, zileSaptamana])

  // Variantă pentru un element grupat din „Lucrări neplanificate" — un
  // singur drag scrie același patch (tehnician + dată, sau ștergerea lor) pe
  // câte un rând `productie_lucrare` pentru FIECARE etapă din grup.
  const handleAlocareMultipla = async (lucrareId, etapaIds, patch) => {
    const cheie = `${lucrareId}-${etapaIds.join(',')}`
    setMutandKey(cheie)
    try {
      await Promise.all(etapaIds.map((etapaId) => setProductieAlocare(lucrareId, etapaId, patch)))
      await reincarcaAlocarile()
    } finally {
      setMutandKey(null)
    }
  }

  // Bifa „Finalizat" a unei căsuțe (grupate) — finalizează/definalizează toate
  // etapele din ea, în același loc din `productie_lucrare` folosit de
  // Producție/Kanban. Etapele deja în starea dorită nu se rescriu (își
  // păstrează data de finalizare).
  const handleFinalizareGrup = async (grup) => {
    const finalizat = !grup.finalizat
    const deSchimbat = grup.alocari.filter((a) => !!a.finalizat !== finalizat)
    setMutandKey(`${grup.lucrare.id}-finalizare`)
    try {
      await Promise.all(
        deSchimbat.map((a) =>
          setProductieAlocare(a.lucrare_id, a.etapa_id, { finalizat, data_finalizare: finalizat ? azi() : null })
        )
      )
      await reincarcaAlocarile()
    } finally {
      setMutandKey(null)
    }
  }

  // Plasarea/mutarea unui card de Livrare = setarea/mutarea termenului de
  // predare al lucrării; triggerul din baza de date mută apoi și rândul de
  // producție. La anulare nu se scrie nimic, iar cardul rămâne pe loc.
  // Întoarce true doar dacă termenul a fost salvat.
  const mutaTermenul = async (lucrareId, dataNoua) => {
    const lucrare = lucrari.find((l) => l.id === lucrareId)
    if (!lucrare || !dataNoua || dataNoua === lucrare.termen_predare) return false
    const ok = lucrare.termen_predare
      ? await confirm(
          `Muți termenul de predare pentru ${lucrare.nr_inregistrare} de pe ${formatData(lucrare.termen_predare)} pe ${formatData(dataNoua)}?`,
          { title: 'Muți termenul de predare?', confirmLabel: 'Mută termenul' }
        )
      : await confirm(`Setezi termenul de predare pentru ${lucrare.nr_inregistrare} pe ${formatData(dataNoua)}?`, {
          title: 'Setezi termenul de predare?',
          confirmLabel: 'Setează termenul',
        })
    if (!ok) return false
    setMutandKey(`${lucrareId}-${livrareAutoId}`)
    try {
      await updateLucrare(lucrareId, { termen_predare: dataNoua })
      await Promise.all([reincarcaLucrarile(), reincarcaAlocarile()])
    } finally {
      setMutandKey(null)
    }
    return true
  }

  // Un grup de etape (din „Lucrări neplanificate" sau o căsuță din calendar)
  // pus pe o zi: Livrarea automată (dacă e în grup) setează/mută termenul de
  // predare — cu confirmare; la anulare nu se mută nimic din grup. Celelalte
  // etape se alocă normal pe acea zi.
  const planificaPeZi = async (lucrareId, ids, zi) => {
    const alte = ids.filter((id) => id !== livrareAutoId)
    if (livrareAutoId && ids.includes(livrareAutoId)) {
      const ok = await mutaTermenul(lucrareId, zi)
      if (!ok) return
    }
    if (alte.length > 0) {
      await handleAlocareMultipla(lucrareId, alte, { tehnician_id: tehnicianSelectat.id, data_planificata: zi })
    }
  }

  // Livrarea automată nu se poate scoate din planificare (data ei e termenul).
  const scoateDinPlanificare = async (lucrareId, ids) => {
    const alte = ids.filter((id) => id !== livrareAutoId)
    if (alte.length > 0) await handleAlocareMultipla(lucrareId, alte, { tehnician_id: null, data_planificata: null })
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || !tehnicianSelectat) return
    const { lucrareId, etapaIds, source, day: sourceDay } = active.data.current || {}
    if (!lucrareId || !etapaIds || etapaIds.length === 0) return
    const targetId = over.id

    if (targetId === NEPLANIFICATE_ID) {
      if (source === 'neplanificate') return
      scoateDinPlanificare(lucrareId, etapaIds)
    } else {
      if (source === 'calendar' && sourceDay === targetId) return
      planificaPeZi(lucrareId, etapaIds, targetId)
    }
  }

  const deschideLucrarea = (lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)

  return (
    <div className="taskuri-page">
      <h2>Task-uri</h2>
      <p className="taskuri-page-hint">
        Alege un tehnician, apoi trage lucrările din „Neplanificate" pe o zi din calendar ca să le aloci.
      </p>

      {loading ? (
        <p className="taskuri-loading">Se încarcă…</p>
      ) : tehnicieni.length === 0 ? (
        <div className="card taskuri-empty">
          <p>Niciun tehnician înregistrat încă. Adaugă tehnicieni din Setup → Tehnicieni.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="taskuri-page-body">
            <div className="taskuri-sidebar">
              <ul className="taskuri-tehnicieni-list">
                {tehnicieni.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={`card taskuri-tehnician-card ${tehnicianSelectat?.id === t.id ? 'active' : ''}`}
                      onClick={() => setTehnicianSelectat(t)}
                    >
                      <span className="taskuri-avatar">{initiale(t.nume)}</span>
                      <span className="taskuri-tehnician-info">
                        <span className="taskuri-tehnician-nume">{t.nume}</span>
                        <span className="taskuri-tehnician-roluri">
                          {(t.roluri || []).length === 0
                            ? 'Fără rol'
                            : t.roluri.map((id) => etapaById(id)?.nume).filter(Boolean).join(', ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="card taskuri-neplanificate-card">
                <h3 className="taskuri-panel-title">Lucrări neplanificate</h3>
                {!tehnicianSelectat ? (
                  <p className="taskuri-panel-hint">Alege un tehnician ca să vezi lucrările lui neplanificate.</p>
                ) : (
                  <DropZone id={NEPLANIFICATE_ID} className="taskuri-neplanificate-list">
                    {lucrariNeplanificate.length === 0 ? (
                      <p className="taskuri-panel-hint">Nicio lucrare neplanificată pentru acest tehnician.</p>
                    ) : (
                      lucrariNeplanificate.map(({ lucrare, etape: etapeGrup }) => {
                        const etapaIds = etapeGrup.map((e) => e.id)
                        const cheieGrup = `${lucrare.id}-${etapaIds.join(',')}`
                        return (
                          <DraggableTaskCard
                            key={lucrare.id}
                            dragId={`neplanificat-${lucrare.id}`}
                            data={{ lucrareId: lucrare.id, etapaIds, source: 'neplanificate' }}
                            disabled={mutandKey === cheieGrup}
                            dragDisabled={isMobil}
                            onOpen={() => deschideLucrarea(lucrare)}
                            title={titluCard(lucrare)}
                            className="taskuri-task-card taskuri-neplanificat-item"
                          >
                            <span className="taskuri-task-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                            <span className="taskuri-task-rand rezumat-medic">{lucrare.medic || '—'}</span>
                            <span className="taskuri-task-rand rezumat-tip">{lucrare.tip_lucrare}</span>
                            <span className="taskuri-task-top">
                              <span className="taskuri-task-nr">{lucrare.nr_inregistrare}</span>
                              <span className="taskuri-task-etapa-badge">
                                {etapeGrup.map((e) => e.nume).join(' + ')}
                              </span>
                            </span>
                          </DraggableTaskCard>
                        )
                      })
                    )}
                  </DropZone>
                )}
              </div>
            </div>

            <div className="card taskuri-calendar">
              <div className="taskuri-week-nav">
                <button
                  type="button"
                  className="btn btn-secondary taskuri-week-btn"
                  onClick={() => setSaptamanaOffset((v) => v - 1)}
                  aria-label="Săptămâna precedentă"
                >
                  ←
                </button>
                <div className="taskuri-week-current">
                  <span className="taskuri-week-label">{formatIntervalSaptamana(zileSaptamana)}</span>
                  {!esteSaptamanaCurenta && (
                    <button type="button" className="btn btn-ghost taskuri-week-today" onClick={() => setSaptamanaOffset(0)}>
                      Săptămâna curentă
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary taskuri-week-btn"
                  onClick={() => setSaptamanaOffset((v) => v + 1)}
                  aria-label="Săptămâna următoare"
                >
                  →
                </button>
              </div>

              {!tehnicianSelectat ? (
                <p className="taskuri-panel-hint taskuri-calendar-hint">Alege un tehnician ca să vezi calendarul lui.</p>
              ) : (
                <>
                  {isMobil && (
                    <div className="taskuri-day-nav">
                      <button
                        type="button"
                        className="btn btn-secondary taskuri-day-nav-btn"
                        onClick={() => setZiAfisataMobil((v) => Math.max(0, v - 1))}
                        disabled={ziAfisataMobil === 0}
                        aria-label="Ziua precedentă"
                      >
                        ‹
                      </button>
                      <div className="taskuri-day-pills">
                        {NUME_ZILE.map((nume, i) => (
                          <button
                            key={nume}
                            type="button"
                            className={`taskuri-day-pill ${i === ziAfisataMobil ? 'active' : ''} ${zileSaptamana[i] === astazi ? 'taskuri-day-pill-azi' : ''}`}
                            onClick={() => setZiAfisataMobil(i)}
                          >
                            <span className="taskuri-day-pill-nume">{nume.slice(0, 2)}</span>
                            <span className="taskuri-day-pill-data">{formatZiScurt(zileSaptamana[i])}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary taskuri-day-nav-btn"
                        onClick={() => setZiAfisataMobil((v) => Math.min(6, v + 1))}
                        disabled={ziAfisataMobil === 6}
                        aria-label="Ziua următoare"
                      >
                        ›
                      </button>
                    </div>
                  )}

                  <div className={`taskuri-week-grid ${isMobil ? 'taskuri-week-grid-mobil' : ''}`}>
                    {zileSaptamana.map((zi, i) => {
                      if (isMobil && i !== ziAfisataMobil) return null
                      return (
                        <DropZone key={zi} id={zi} className={`taskuri-day-column ${zi === astazi ? 'taskuri-day-azi' : ''}`}>
                          <button
                            type="button"
                            className="taskuri-day-header"
                            onClick={() => setZiModalDeschisa(zi)}
                            aria-label={`Vezi detaliile zilei de ${NUME_ZILE[i]}`}
                          >
                            <span className="taskuri-day-nume">{NUME_ZILE[i]}</span>
                            <span className="taskuri-day-data">{formatZiScurt(zi)}</span>
                          </button>
                          <div className="taskuri-day-body">
                            {(taskuriPeZi[zi] || []).length === 0 && <p className="taskuri-day-empty">—</p>}
                            {(taskuriPeZi[zi] || []).map((grup) => (
                              <DraggableTaskCard
                                key={grup.cheie}
                                dragId={`planificat-${grup.cheie}`}
                                data={{ lucrareId: grup.lucrare.id, etapaIds: grup.etapaIds, source: 'calendar', day: zi }}
                                disabled={!!mutandKey && mutandKey.startsWith(`${grup.lucrare.id}-`)}
                                dragDisabled={isMobil}
                                onOpen={() => deschideLucrarea(grup.lucrare)}
                                title={titluCard(grup.lucrare)}
                                className="taskuri-task-card taskuri-day-card"
                              >
                                <span className="taskuri-day-card-rand rezumat-pacient">{grup.lucrare.pacient || '—'}</span>
                                <span className="taskuri-day-card-rand rezumat-medic">{grup.lucrare.medic || '—'}</span>
                                <span className="taskuri-day-card-rand rezumat-tip">{grup.lucrare.tip_lucrare}</span>
                                {grup.lucrare.clinica && (
                                  <span className="taskuri-day-card-rand taskuri-day-card-clinica">{grup.lucrare.clinica}</span>
                                )}
                              </DraggableTaskCard>
                            ))}
                          </div>
                        </DropZone>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </DndContext>
      )}

      {ziModalDeschisa && tehnicianSelectat && (
        <TaskuriZiModal
          zi={ziModalDeschisa}
          zileSaptamana={zileSaptamana}
          numeZile={NUME_ZILE}
          tehnician={tehnicianSelectat}
          sarcini={taskuriPeZi[ziModalDeschisa] || []}
          lucrariNeplanificate={lucrariNeplanificate}
          etapaDinTermenId={livrareAutoId}
          isMobil={isMobil}
          onClose={() => setZiModalDeschisa(null)}
          onToggleFinalizat={handleFinalizareGrup}
          onOpenLucrare={deschideLucrarea}
          onAsigneaza={(lucrareId, etapaIds) => planificaPeZi(lucrareId, etapaIds, ziModalDeschisa)}
          onMuta={(lucrareId, etapaIds, ziNoua) => planificaPeZi(lucrareId, etapaIds, ziNoua)}
          onElimina={scoateDinPlanificare}
        />
      )}

      {confirmDialog}
    </div>
  )
}
