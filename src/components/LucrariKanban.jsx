import { useCallback, useEffect, useState } from 'react'
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
import { getEtapeProductie, getToateAlocarile, getTehnicieni, setProductieAlocare } from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { etapaCurentaPentru } from '../utils/etapaProductie'
import { subscribeToTable } from '../services/realtime'
import './LucrariKanban.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function initiale(nume) {
  if (!nume) return ''
  return nume
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const COLOANA_FINALIZAT = '__finalizat__'

// Coloana — și zonă de „drop", și container vizual pentru cardurile ei.
function KanbanColumn({ coloana, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: coloana.id })
  return (
    <div ref={setNodeRef} className={`kanban-column ${isOver ? 'kanban-column-over' : ''}`}>
      {children}
    </div>
  )
}

// Cardul — draggable; un click simplu (fără deplasare peste pragul de
// activare) tot deschide fișa, pentru că dnd-kit nu „fură" evenimentul de
// click decât dacă tragerea chiar a pornit (vezi activationConstraint).
function KanbanCard({ lucrare, coloanaId, disabled, onOpen, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lucrare.id,
    data: { coloanaId },
    disabled,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`kanban-card ${isDragging ? 'kanban-card-dragging' : ''}`}
    >
      <button type="button" className="kanban-card-open" onClick={onOpen} disabled={disabled}>
        {children}
      </button>
    </div>
  )
}

export default function LucrariKanban({ lucrari, onRowClick }) {
  const [etape, setEtape] = useState([])
  const [alocari, setAlocari] = useState([])
  const [tehnicieni, setTehnicieni] = useState([])
  const [loading, setLoading] = useState(true)
  const [mutandId, setMutandId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [e, a, t] = await Promise.all([getEtapeProductie(), getToateAlocarile(), getTehnicieni()])
      setEtape(e)
      setAlocari(a)
      setTehnicieni(t)
      setLoading(false)
    }
    load()
  }, [])

  const reincarcaAlocarile = useCallback(async () => {
    setAlocari(await getToateAlocarile())
  }, [])

  // Realtime: o etapă bifată/debifată (inclusiv „Model" din Producție)
  // mută automat cardul lucrării în coloana următoare, fără reîncărcare.
  useEffect(() => {
    const unsubscribe = subscribeToTable('productie_lucrare', () => reincarcaAlocarile())
    return unsubscribe
  }, [reincarcaAlocarile])

  // Mutare manuală a unui card între coloane (drag & drop sau, echivalent,
  // orice alt declanșator) — bifează/debifează automat etapele „sărite" ca
  // poziția pe Kanban (prima etapă nefinalizată) să reflecte corect noua
  // coloană. Scrie prin `setProductieAlocare`, aceeași cale folosită de
  // bifarea normală — Realtime propagă mutarea și în celelalte ecrane
  // (Task-uri, fișa lucrării), fără cod suplimentar.
  const handleMutare = async (lucrare, etapeOrdonate, targetId) => {
    const randuriLucrare = alocari.filter((a) => a.lucrare_id === lucrare.id)
    const { etapa: etapaCurenta } = etapaCurentaPentru(etapeOrdonate, randuriLucrare)
    const oldIndex = etapaCurenta ? etapeOrdonate.findIndex((e) => e.id === etapaCurenta.id) : etapeOrdonate.length
    const targetIndex = targetId === COLOANA_FINALIZAT ? etapeOrdonate.length : etapeOrdonate.findIndex((e) => e.id === targetId)
    if (targetIndex === oldIndex) return

    setMutandId(lucrare.id)
    try {
      const azi_ = azi()
      const scrieri = []
      if (targetIndex > oldIndex) {
        for (let i = oldIndex; i < targetIndex; i++) {
          scrieri.push(setProductieAlocare(lucrare.id, etapeOrdonate[i].id, { finalizat: true, data_finalizare: azi_ }))
        }
        if (targetIndex < etapeOrdonate.length) {
          scrieri.push(setProductieAlocare(lucrare.id, etapeOrdonate[targetIndex].id, { finalizat: false, data_finalizare: null }))
        }
      } else {
        for (let i = targetIndex; i < oldIndex; i++) {
          scrieri.push(setProductieAlocare(lucrare.id, etapeOrdonate[i].id, { finalizat: false, data_finalizare: null }))
        }
      }
      await Promise.all(scrieri)
      await reincarcaAlocarile()
    } finally {
      setMutandId(null)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over) return
    const sourceColumnId = active.data.current?.coloanaId
    const targetColumnId = over.id
    if (!targetColumnId || targetColumnId === sourceColumnId) return
    const lucrare = lucrari.find((l) => l.id === active.id)
    if (!lucrare) return
    handleMutare(lucrare, etape, targetColumnId)
  }

  if (loading) {
    return <p className="kanban-loading">Se încarcă…</p>
  }

  if (etape.length === 0) {
    return (
      <div className="card kanban-empty">
        <p>Nicio etapă de producție definită încă — adaugă etape din Setup → Etape de producție.</p>
      </div>
    )
  }

  const astazi = azi()
  const pragUrgent = adaugaZile(astazi, 2)

  const coloane = [
    ...etape.map((e) => ({ id: e.id, nume: e.nume })),
    { id: COLOANA_FINALIZAT, nume: 'Finalizat' },
  ]

  const grupuri = Object.fromEntries(coloane.map((c) => [c.id, []]))

  for (const l of lucrari) {
    const randuriLucrare = alocari.filter((a) => a.lucrare_id === l.id)
    const { etapa: etapaCurenta, rand: randCurent } = etapaCurentaPentru(etape, randuriLucrare)
    const coloanaId = etapaCurenta ? etapaCurenta.id : COLOANA_FINALIZAT
    grupuri[coloanaId].push({ lucrare: l, rand: randCurent })
  }

  const tehnicianById = (id) => tehnicieni.find((t) => t.id === id)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {coloane.map((coloana) => {
          const carduri = grupuri[coloana.id] || []
          const finalizata = coloana.id === COLOANA_FINALIZAT
          return (
            <KanbanColumn key={coloana.id} coloana={coloana}>
              <div className="kanban-column-header">
                <span className="kanban-column-title">{coloana.nume}</span>
                <span className="kanban-column-count">{carduri.length}</span>
              </div>

              <div className="kanban-column-body">
                {carduri.length === 0 && <p className="kanban-column-empty">—</p>}
                {carduri.map(({ lucrare, rand }) => {
                  const tehnician = rand?.tehnician_id ? tehnicianById(rand.tehnician_id) : null
                  const depasit = !finalizata && lucrare.termen_predare && lucrare.termen_predare < astazi
                  const urgent = !finalizata && !depasit && lucrare.termen_predare && lucrare.termen_predare <= pragUrgent
                  return (
                    <KanbanCard
                      key={lucrare.id}
                      lucrare={lucrare}
                      coloanaId={coloana.id}
                      disabled={mutandId === lucrare.id}
                      onOpen={() => onRowClick(lucrare)}
                    >
                      <div className="kanban-card-top">
                        <span className="kanban-card-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                        {tehnician && (
                          <span className="kanban-card-tehnician" title={tehnician.nume}>
                            {initiale(tehnician.nume)}
                          </span>
                        )}
                      </div>
                      <p className="kanban-card-medic rezumat-medic">{lucrare.medic || '—'}</p>
                      <p className="kanban-card-tip rezumat-tip">{lucrare.tip_lucrare}</p>
                      <div className="kanban-card-meta">
                        <span className="kanban-card-nr">{lucrare.nr_inregistrare}</span>
                        <span
                          className={`kanban-card-termen ${depasit ? 'kanban-card-termen-depasit' : ''} ${urgent ? 'kanban-card-termen-urgent' : ''}`}
                        >
                          {formatData(lucrare.termen_predare)}
                        </span>
                      </div>
                    </KanbanCard>
                  )
                })}
              </div>
            </KanbanColumn>
          )
        })}
      </div>
    </DndContext>
  )
}
