import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  useDndContext,
} from '@dnd-kit/core'
import {
  getTehnicieni,
  getEtapeProductie,
  getLucrari,
  getToateAlocarile,
  setProductieAlocare,
  inchideEtapeRetroactiv,
  updateLucrare,
} from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { configLivrare, esteEtapaModel } from '../utils/etapaProductie'
import { esteEtapaDesign } from '../utils/adaosuriDesign'
import { neprogramatePeEtapa, etapeFaraTehnician, lucrariRestante } from '../utils/etapeNeplanificate'
import { filtreazaCasete, aplicaPatchAlocari, urgentaCaseta } from '../utils/casetePlanificare'
import { estePatron } from '../utils/roluri'
import { dataScurta } from '../utils/urgenta'
import { subscribeToTable } from '../services/realtime'
import { useConfirm } from '../hooks/useConfirm.jsx'
import TaskuriZiModal from './TaskuriZiModal.jsx'
import RestanteModal from './RestanteModal.jsx'
import FacuteSaptamana from './FacuteSaptamana.jsx'
import DeschideFisaButton from './DeschideFisaButton.jsx'
import { TitluCuAjutor } from '../ajutor/Ajutor.jsx'
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
function DropZone({ id, etapaId, className, children }) {
  // O casetă se poate pune doar pe zilele/zona din secțiunea ETAPEI ei: zonele
  // celorlalte secțiuni nu sunt active cât se trage (nu se evidențiază).
  const { active } = useDndContext()
  const compatibila = !etapaId || !active || active.data.current?.etapaId === etapaId
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !compatibila })
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
// În timpul tragerii, cardul rămâne pe loc (estompat), iar copia care urmărește
// mouse-ul e `DragOverlay` din pagină — așa nu e tăiată de zonele din jur.
function DraggableTaskCard({ dragId, data, disabled, dragDisabled, onOpen, className, title, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data,
    disabled: disabled || dragDisabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={title}
      className={`${className} ${isDragging ? 'taskuri-task-card-dragging' : ''} ${dragDisabled ? 'taskuri-task-card-fix' : ''}`}
    >
      <button type="button" className="taskuri-task-open" onClick={onOpen} disabled={disabled}>
        {children}
      </button>
      <DeschideFisaButton className="taskuri-task-fisa" onClick={onOpen} />
    </div>
  )
}

// Coliziune după poziția mouse-ului (ziua peste care ții caseta); dacă mouse-ul
// nu e peste nicio zonă, cea mai apropiată.
function coliziune(args) {
  const peste = pointerWithin(args)
  return peste.length > 0 ? peste : closestCenter(args)
}

function IconUrgenta({ nivel }) {
  return nivel === 'rosu' ? (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.2L14.4 13.4H1.6L8 2.2z" />
      <path d="M8 6.6v3.2M8 11.6v.1" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.4 1.6" />
    </svg>
  )
}

// Ce se vede pe o casetă „neprogramată": pacientul, tipul lucrării și numărul de
// elemente — ce urmărești la programare. Restul (nr. comandă, medic, clinică,
// termen, etape) e în titlul de la hover și în fișa lucrării. Urgența are text și
// icoană (nu doar culoare) și apare doar pentru termenele apropiate sau depășite.
function CasetaContinut({ lucrare, urgenta }) {
  return (
    <>
      <span className="taskuri-caseta-pacient">{lucrare.pacient || '—'}</span>
      <span className="taskuri-caseta-tip">{lucrare.tip_lucrare || '—'}</span>
      <span className="taskuri-caseta-jos">
        <span className="taskuri-caseta-meta">{lucrare.nr_elemente ?? 0} elem.</span>
        {urgenta.nivel !== 'neutru' && (
          <span className={`taskuri-caseta-urg taskuri-caseta-urg-${urgenta.nivel}`}>
            <IconUrgenta nivel={urgenta.nivel} />
            {urgenta.eticheta}
          </span>
        )}
      </span>
    </>
  )
}

function titluCard(lucrare, etapeGrup) {
  return [
    `Pacient: ${lucrare.pacient || '—'}`,
    `Medic: ${lucrare.medic || '—'}`,
    `Tip lucrare: ${lucrare.tip_lucrare || '—'}`,
    `Clinică: ${lucrare.clinica || '—'}`,
    `Nr. elemente: ${lucrare.nr_elemente ?? 0}`,
    `Termen de predare: ${formatData(lucrare.termen_predare)}`,
    etapeGrup && etapeGrup.length > 0 ? `Etape: ${etapeGrup.map((e) => e.nume).join(' + ')}` : null,
    lucrare.nr_inregistrare,
  ]
    .filter(Boolean)
    .join('\n')
}

export default function TaskuriPage({ profile }) {
  const navigate = useNavigate()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [tehnicieni, setTehnicieni] = useState([])
  const [etape, setEtape] = useState([])
  const [lucrari, setLucrari] = useState([])
  // Și lucrările arhivate (finalizatele se arhivează la deviz) — pentru istoricul „Făcute în săptămâna asta".
  const [lucrariToate, setLucrariToate] = useState([])
  const [alocari, setAlocari] = useState([])
  const [loading, setLoading] = useState(true)
  const [tehnicianSelectat, setTehnicianSelectat] = useState(null)
  const [saptamanaOffset, setSaptamanaOffset] = useState(0)
  const [mutandKey, setMutandKey] = useState(null)
  const [ziModalDeschisa, setZiModalDeschisa] = useState(null)
  const [alertaDeschisa, setAlertaDeschisa] = useState(false)
  const [doarUrgente, setDoarUrgente] = useState(false)
  // Lucrările finalizate sunt ascunse implicit din zilele calendarului.
  const [arataFinalizate, setArataFinalizate] = useState(false)
  const [mesajEroare, setMesajEroare] = useState('')
  // Ce se trage acum (pentru copia care urmărește mouse-ul).
  const [activ, setActiv] = useState(null)
  const alocariRef = useRef([])
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

  alocariRef.current = alocari

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    setLoading(true)
    const [t, e, l, a] = await Promise.all([getTehnicieni(), getEtapeProductie(), getLucrari(), getToateAlocarile()])
    setTehnicieni(t)
    setEtape(e)
    setLucrari(l.filter((x) => !x.arhivat))
    setLucrariToate(l)
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
    setLucrariToate(l)
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

  // Ce așteaptă programare, pe etapă: o lucrare apare doar la etapa ei CURENTĂ din
  // Kanban (la Design, cât timp Model nu e bifat) — logica e în
  // utils/etapeNeplanificate.js. Nu intră lucrările restante (termen depășit), care
  // merg în alerta „lucrări restante".
  const programatePeEtapa = useMemo(
    () => neprogramatePeEtapa({ lucrari, etape, alocari, livrareAutoId, astazi }),
    [lucrari, etape, alocari, livrareAutoId, astazi]
  )

  // Etape la care așteaptă lucrări, dar pe care nu le are niciun tehnician în roluri.
  const etapeFaraOm = useMemo(
    () => etapeFaraTehnician({ etape, tehnicieni, programatePeEtapa }),
    [etape, tehnicieni, programatePeEtapa]
  )

  // Casetele unei etape, cu filtrul „doar urgente".
  const casetePentru = (etapaId) =>
    filtreazaCasete({
      casete: (programatePeEtapa.get(etapaId) || []).map(({ lucrare, etapa }) => ({ lucrare, etape: [etapa] })),
      etapaId: null,
      doarUrgente,
      astazi,
    })

  // Lucrările restante: termenul de predare a trecut (sunt deja în clinică), dar
  // au etape neprogramate și nebifate — se închid din alertă, nu se mai planifică.
  const restante = useMemo(
    () => lucrariRestante({ lucrari, etape, alocari, livrareAutoId, astazi }),
    [lucrari, etape, alocari, livrareAutoId, astazi]
  )

  // O etapă bifată nu se mai mută și nu se scoate din planificare: scoaterea îi
  // șterge tehnicianul, iar etapa ar ieși din salariul lui.
  const etapaFinalizata = (lucrareId, etapaId) =>
    !!alocari.find((a) => a.lucrare_id === lucrareId && a.etapa_id === etapaId)?.finalizat

  const handleInchideEtape = async (randuri, data) => {
    await inchideEtapeRetroactiv(randuri, data)
    await reincarcaAlocarile()
  }

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

  // Secțiunile tehnicianului selectat: câte una pe etapă din rolurile lui (în ordinea
  // din Setup), plus orice etapă la care are deja sarcini în săptămâna vizibilă, ca să
  // nu dispară sarcini dacă un rol i-a fost scos.
  const sarciniPeEtapaSiZi = useMemo(() => {
    const map = new Map()
    if (!tehnicianSelectat) return map
    for (const a of alocari) {
      if (a.tehnician_id !== tehnicianSelectat.id) continue
      if (!a.data_planificata || !zileSaptamana.includes(a.data_planificata)) continue
      const lucrare = lucrari.find((l) => l.id === a.lucrare_id)
      if (!lucrare) continue
      if (!map.has(a.etapa_id)) map.set(a.etapa_id, Object.fromEntries(zileSaptamana.map((zi) => [zi, []])))
      map.get(a.etapa_id)[a.data_planificata].push({
        cheie: `${lucrare.id}|${a.etapa_id}|${a.data_planificata}`,
        lucrare,
        alocari: [a],
        etapaIds: [a.etapa_id],
        finalizat: !!a.finalizat,
      })
    }
    return map
  }, [alocari, lucrari, tehnicianSelectat, zileSaptamana])

  const sectiuni = useMemo(() => {
    if (!tehnicianSelectat) return []
    const roluri = new Set(tehnicianSelectat.roluri || [])
    // O etapă din afara rolurilor apare doar cât mai are sarcini NEfăcute (să nu dispară);
    // cele deja finalizate rămân în istoric („Făcute în săptămâna asta"), nu ca secțiune.
    const maiAreDeFacut = (etapaId) =>
      Object.values(sarciniPeEtapaSiZi.get(etapaId) || {}).some((grupuri) => grupuri.some((g) => !g.finalizat))
    return etape.filter((e) => (!esteEtapaModel(e) && roluri.has(e.id)) || maiAreDeFacut(e.id))
  }, [etape, tehnicianSelectat, sarciniPeEtapaSiZi])

  // Toate neprogramatele secțiunilor (pentru „Asignează" din fereastra zilei).
  const lucrariNeplanificate = useMemo(
    () =>
      sectiuni
        .flatMap((e) => (programatePeEtapa.get(e.id) || []).map(({ lucrare, etapa }) => ({ lucrare, etape: [etapa] })))
        .sort((x, y) => {
          const tx = x.lucrare.termen_predare
          const ty = y.lucrare.termen_predare
          if (tx === ty) return 0
          if (!tx) return 1
          if (!ty) return -1
          return tx < ty ? -1 : 1
        }),
    [sectiuni, programatePeEtapa]
  )

  // Variantă pentru un element grupat din „Lucrări neplanificate" — un
  // singur drag scrie același patch (tehnician + dată, sau ștergerea lor) pe
  // câte un rând `productie_lucrare` pentru FIECARE etapă din grup.
  // Ecranul se actualizează imediat (caseta trece în zi); dacă scrierea în baza de
  // date eșuează, revine starea de dinainte și apare un mesaj clar.
  //
  // Programarea Designului pe o zi bifează automat etapa Model (data finalizării =
  // azi), ca lucrarea să treacă pe Kanban în coloana Design. Rândul Model rămâne fără
  // tehnician, deci nu generează comision (Model nici nu are comision definit).
  const handleAlocareMultipla = async (lucrareId, etapaIds, patch) => {
    const cheie = `${lucrareId}-${etapaIds.join(',')}`
    const inainte = alocariRef.current
    const etapaModel = etape.find(esteEtapaModel)
    const etapaDesign = etape.find(esteEtapaDesign)
    const bifeazaModel =
      !!patch.data_planificata &&
      !!etapaModel &&
      !!etapaDesign &&
      etapaIds.includes(etapaDesign.id) &&
      !inainte.find((a) => a.lucrare_id === lucrareId && a.etapa_id === etapaModel.id)?.finalizat
    const patchModel = { finalizat: true, data_finalizare: azi() }
    setMutandKey(cheie)
    setMesajEroare('')
    let optimist = aplicaPatchAlocari(inainte, lucrareId, etapaIds, patch)
    if (bifeazaModel) optimist = aplicaPatchAlocari(optimist, lucrareId, [etapaModel.id], patchModel)
    setAlocari(optimist)
    const nr = lucrari.find((l) => l.id === lucrareId)?.nr_inregistrare || 'lucrarea'
    try {
      await Promise.all(etapaIds.map((etapaId) => setProductieAlocare(lucrareId, etapaId, patch)))
    } catch (err) {
      setAlocari(inainte)
      setMesajEroare(`Nu s-a putut salva programarea pentru ${nr}: ${err.message || 'eroare necunoscută'}. Lucrarea a revenit la loc — încearcă din nou.`)
      reincarcaAlocarile().catch(() => {})
      setMutandKey(null)
      return
    }
    if (bifeazaModel) {
      try {
        await setProductieAlocare(lucrareId, etapaModel.id, patchModel)
      } catch (err) {
        setMesajEroare(`Designul pentru ${nr} a fost programat, dar etapa Model nu s-a putut bifa automat: ${err.message || 'eroare necunoscută'}. Bifeaz-o din fișa lucrării.`)
      }
    }
    try {
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
    const alte = ids.filter((id) => id !== livrareAutoId && !etapaFinalizata(lucrareId, id))
    if (livrareAutoId && ids.includes(livrareAutoId)) {
      const ok = await mutaTermenul(lucrareId, zi)
      if (!ok) return
    }
    if (alte.length > 0) {
      await handleAlocareMultipla(lucrareId, alte, { tehnician_id: tehnicianSelectat.id, data_planificata: zi })
    }
  }

  // Livrarea automată nu se poate scoate din planificare (data ei e termenul),
  // iar etapele bifate rămân pe tehnicianul lor.
  const scoateDinPlanificare = async (lucrareId, ids) => {
    const alte = ids.filter((id) => id !== livrareAutoId && !etapaFinalizata(lucrareId, id))
    if (alte.length > 0) await handleAlocareMultipla(lucrareId, alte, { tehnician_id: null, data_planificata: null })
  }

  const handleDragStart = (event) => {
    const { lucrareId, etapaIds, source } = event.active.data.current || {}
    const lucrare = lucrari.find((l) => l.id === lucrareId)
    if (!lucrare) return
    setActiv({
      lucrare,
      source,
      etapeGrup: (etapaIds || []).map((id) => etapaById(id)).filter(Boolean),
    })
  }

  const handleDragEnd = (event) => {
    setActiv(null)
    const { active, over } = event
    if (!over || !tehnicianSelectat) return
    const { lucrareId, etapaIds, etapaId, source, day: sourceDay } = active.data.current || {}
    if (!lucrareId || !etapaIds || etapaIds.length === 0) return
    const [prefix, sufix] = String(over.id).split('|')

    if (prefix === NEPLANIFICATE_ID) {
      // Zona de neprogramate a etapei: doar a etapei casetei.
      if (sufix !== etapaId || source === 'neplanificate') return
      scoateDinPlanificare(lucrareId, etapaIds)
    } else {
      // Ziua unei secțiuni: doar din aceeași etapă.
      if (prefix !== etapaId) return
      if (source === 'calendar' && sourceDay === sufix) return
      planificaPeZi(lucrareId, etapaIds, sufix)
    }
  }

  const deschideLucrarea = (lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)

  // O secțiune = o etapă din rolurile tehnicianului: calendarul cu sarcinile lui pe
  // acea etapă + lucrările care așteaptă programare la ea.
  const renderSectiune = (etapa) => {
    const peZi = sarciniPeEtapaSiZi.get(etapa.id) || {}
    const nrProgramate = zileSaptamana.reduce((n, zi) => n + (peZi[zi] || []).length, 0)
    const toateNeprogramate = programatePeEtapa.get(etapa.id) || []
    const casete = casetePentru(etapa.id)
    return (
      <section key={etapa.id} className="taskuri-sectiune" aria-label={`Etapa ${etapa.nume}`}>
        <h3 className="taskuri-sectiune-titlu">
          <span>{etapa.nume}</span>
          <span className="taskuri-sectiune-nr">
            {nrProgramate} {nrProgramate === 1 ? 'programată' : 'programate'} în săptămână · {toateNeprogramate.length} neprogramate
          </span>
        </h3>

        <div className="card taskuri-calendar taskuri-calendar-sticky">
          <div className={`taskuri-week-grid ${isMobil ? 'taskuri-week-grid-mobil' : ''}`}>
            {zileSaptamana.map((zi, i) => {
              if (isMobil && i !== ziAfisataMobil) return null
              const toateZi = peZi[zi] || []
              const finalizateZi = toateZi.filter((g) => g.finalizat).length
              const ramaseZi = toateZi.length - finalizateZi
              const carduri = arataFinalizate ? toateZi : toateZi.filter((g) => !g.finalizat)
              return (
                <DropZone
                  key={zi}
                  id={`${etapa.id}|${zi}`}
                  etapaId={etapa.id}
                  className={`taskuri-day-column ${zi === astazi ? 'taskuri-day-azi' : ''}`}
                >
                  <button
                    type="button"
                    className="taskuri-day-header"
                    onClick={() => setZiModalDeschisa(zi)}
                    aria-label={`Vezi detaliile zilei de ${NUME_ZILE[i]}`}
                  >
                    <span className="taskuri-day-nume">{NUME_ZILE[i]}</span>
                    <span className="taskuri-day-data">
                      {formatZiScurt(zi)}
                      {ramaseZi > 0 && (
                        <span className="taskuri-day-nr" title="Lucrări rămase de făcut în această zi">{ramaseZi}</span>
                      )}
                    </span>
                    {toateZi.length > 0 && (
                      <span className="taskuri-day-contor" title="Finalizate din cele programate în această zi">
                        {finalizateZi}/{toateZi.length} finalizate
                      </span>
                    )}
                  </button>
                  <div className="taskuri-day-body">
                    {carduri.length === 0 && (
                      <p className="taskuri-day-empty">{toateZi.length > 0 ? '✓ Toate finalizate' : '—'}</p>
                    )}
                    {carduri.map((grup) => (
                      <DraggableTaskCard
                        key={grup.cheie}
                        dragId={`planificat-${grup.cheie}`}
                        data={{ lucrareId: grup.lucrare.id, etapaIds: grup.etapaIds, etapaId: etapa.id, source: 'calendar', day: zi }}
                        disabled={!!mutandKey && mutandKey.startsWith(`${grup.lucrare.id}-`)}
                        dragDisabled={isMobil || grup.finalizat}
                        onOpen={() => deschideLucrarea(grup.lucrare)}
                        title={titluCard(grup.lucrare, [etapa])}
                        className={`taskuri-task-card taskuri-day-card ${grup.finalizat ? 'taskuri-day-card-finalizat' : ''}`}
                      >
                        <span className="taskuri-day-card-rand rezumat-pacient">{grup.lucrare.pacient || '—'}</span>
                        <span className="taskuri-day-card-rand taskuri-day-card-tip">{grup.lucrare.tip_lucrare}</span>
                        {grup.finalizat && <span className="taskuri-day-card-fin">✓ Finalizat</span>}
                      </DraggableTaskCard>
                    ))}
                  </div>
                </DropZone>
              )
            })}
          </div>
        </div>

        <section className="card taskuri-casete" aria-label={`Lucrări neprogramate la ${etapa.nume}`}>
          <div className="taskuri-casete-antet">
            <h4 className="taskuri-panel-title">
              Neprogramate la {etapa.nume}
              {toateNeprogramate.length > 0 && (
                <span className="taskuri-casete-nr">
                  {casete.length === toateNeprogramate.length ? casete.length : `${casete.length} din ${toateNeprogramate.length}`}
                </span>
              )}
            </h4>
          </div>
          <DropZone id={`${NEPLANIFICATE_ID}|${etapa.id}`} etapaId={etapa.id} className="taskuri-casete-lista">
            {toateNeprogramate.length === 0 ? (
              <p className="taskuri-panel-hint">Nicio lucrare nu așteaptă programare la {etapa.nume}.</p>
            ) : casete.length === 0 ? (
              <p className="taskuri-panel-hint">
                Nicio lucrare urgentă.{' '}
                <button type="button" className="taskuri-filtre-reset" onClick={() => setDoarUrgente(false)}>
                  Arată toate
                </button>
              </p>
            ) : (
              casete.map(({ lucrare }) => {
                const cheieGrup = `${lucrare.id}-${etapa.id}`
                const urgenta = urgentaCaseta(lucrare.termen_predare, astazi)
                return (
                  <DraggableTaskCard
                    key={lucrare.id}
                    dragId={`neplanificat-${etapa.id}-${lucrare.id}`}
                    data={{ lucrareId: lucrare.id, etapaIds: [etapa.id], etapaId: etapa.id, source: 'neplanificate' }}
                    disabled={mutandKey === cheieGrup}
                    dragDisabled={isMobil}
                    onOpen={() => deschideLucrarea(lucrare)}
                    title={titluCard(lucrare, [etapa])}
                    className={`taskuri-task-card taskuri-caseta taskuri-caseta-${urgenta.nivel}`}
                  >
                    <CasetaContinut lucrare={lucrare} urgenta={urgenta} />
                  </DraggableTaskCard>
                )
              })
            )}
          </DropZone>
        </section>
      </section>
    )
  }

  return (
    <div className="taskuri-page">
      <div className="taskuri-antet">
        <TitluCuAjutor id="taskuri">Task-uri</TitluCuAjutor>

        {!loading && restante.length > 0 && (
          <button type="button" className="taskuri-alerta-btn" onClick={() => setAlertaDeschisa(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 2.2L14.4 13.4H1.6L8 2.2z" />
              <path d="M8 6.6v3.2M8 11.6v.1" />
            </svg>
            <span className="taskuri-alerta-nr">{restante.length}</span>
            <span>{restante.length === 1 ? 'lucrare restantă de închis' : 'lucrări restante de închis'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="taskuri-loading">Se încarcă…</p>
      ) : tehnicieni.length === 0 ? (
        <div className="card taskuri-empty">
          <p>Niciun tehnician înregistrat încă. Adaugă tehnicieni din Setup → Tehnicieni.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={coliziune}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiv(null)}
        >
          <div className="taskuri-page-body">
            <ul className="taskuri-tehnicieni-bara" aria-label="Tehnicieni">
              {tehnicieni.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`taskuri-tehnician-chip ${tehnicianSelectat?.id === t.id ? 'active' : ''}`}
                    onClick={() => setTehnicianSelectat(t)}
                    aria-pressed={tehnicianSelectat?.id === t.id}
                    title={(t.roluri || []).map((id) => etapaById(id)?.nume).filter(Boolean).join(', ') || 'Fără rol'}
                  >
                    <span className="taskuri-avatar-mic">{initiale(t.nume)}</span>
                    <span className="taskuri-tehnician-nume">{t.nume}</span>
                  </button>
                </li>
              ))}
            </ul>

            {etapeFaraOm.length > 0 && (
              <ul className="taskuri-avertismente" aria-label="Etape fără tehnician">
                {etapeFaraOm.map(({ etapa, nr }) => (
                  <li key={etapa.id} className="taskuri-avertisment">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 2.2L14.4 13.4H1.6L8 2.2z" />
                      <path d="M8 6.6v3.2M8 11.6v.1" />
                    </svg>
                    <span>
                      <strong>Nicio persoană alocată la {etapa.nume}</strong> — {nr} {nr === 1 ? 'lucrare așteaptă' : 'lucrări așteaptă'} această etapă.
                      Adaug-o la rolurile unui tehnician din Setup → Tehnicieni.
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!tehnicianSelectat ? (
              <p className="taskuri-panel-hint taskuri-calendar-hint">Alege un tehnician ca să vezi etapele și calendarul lui.</p>
            ) : (
              <>
                <div className="card taskuri-bara-saptamana">
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
                      <span className="taskuri-week-tehnician">{tehnicianSelectat.nume}</span>
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

                  <div className="taskuri-filtre taskuri-bara-filtre" role="group" aria-label="Filtre rapide">
                    <button
                      type="button"
                      className={`taskuri-filtru ${arataFinalizate ? 'activ' : ''}`}
                      aria-pressed={arataFinalizate}
                      onClick={() => setArataFinalizate((v) => !v)}
                    >
                      Arată și finalizatele
                    </button>
                    <button
                      type="button"
                      className={`taskuri-filtru taskuri-filtru-urgente ${doarUrgente ? 'activ' : ''}`}
                      aria-pressed={doarUrgente}
                      onClick={() => setDoarUrgente((v) => !v)}
                    >
                      Doar urgente
                    </button>
                  </div>

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
                        {NUME_ZILE.map((nume, idx) => (
                          <button
                            key={nume}
                            type="button"
                            className={`taskuri-day-pill ${idx === ziAfisataMobil ? 'active' : ''} ${zileSaptamana[idx] === astazi ? 'taskuri-day-pill-azi' : ''}`}
                            onClick={() => setZiAfisataMobil(idx)}
                          >
                            <span className="taskuri-day-pill-nume">{nume.slice(0, 2)}</span>
                            <span className="taskuri-day-pill-data">{formatZiScurt(zileSaptamana[idx])}</span>
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
                </div>

                {sectiuni.length === 0 ? (
                  <p className="taskuri-panel-hint taskuri-calendar-hint">
                    {tehnicianSelectat.nume} nu are încă niciun rol de producție. Adaugă-i o etapă din Setup → Tehnicieni.
                  </p>
                ) : (
                  sectiuni.map(renderSectiune)
                )}
              </>
            )}
          </div>

          {tehnicianSelectat && (
            <FacuteSaptamana
              tehnicianId={tehnicianSelectat.id}
              alocari={alocari}
              lucrari={lucrariToate}
              etape={etape}
              astazi={astazi}
              onOpenLucrare={deschideLucrarea}
            />
          )}

          <DragOverlay dropAnimation={null}>
            {activ &&
              (activ.source === 'neplanificate' ? (
                <div className={`taskuri-task-card taskuri-caseta taskuri-caseta-${urgentaCaseta(activ.lucrare.termen_predare, astazi).nivel} taskuri-overlay`}>
                  <span className="taskuri-task-open">
                    <CasetaContinut lucrare={activ.lucrare} urgenta={urgentaCaseta(activ.lucrare.termen_predare, astazi)} />
                  </span>
                </div>
              ) : (
                <div className="taskuri-task-card taskuri-day-card taskuri-overlay">
                  <span className="taskuri-task-open">
                    <span className="taskuri-day-card-rand rezumat-pacient">{activ.lucrare.pacient || '—'}</span>
                    <span className="taskuri-day-card-rand rezumat-tip">{activ.lucrare.tip_lucrare}</span>
                  </span>
                </div>
              ))}
          </DragOverlay>
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

      {alertaDeschisa && restante.length > 0 && (
        <RestanteModal
          intrari={restante}
          tehnicieni={tehnicieni}
          esteSumeVizibile={estePatron(profile)}
          astazi={astazi}
          onInchide={handleInchideEtape}
          onOpenLucrare={deschideLucrarea}
          onClose={() => setAlertaDeschisa(false)}
        />
      )}

      {mesajEroare && (
        <div className="taskuri-eroare-toast" role="alert">
          <span>{mesajEroare}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setMesajEroare('')} aria-label="Închide mesajul">✕</button>
        </div>
      )}

      {confirmDialog}
    </div>
  )
}
