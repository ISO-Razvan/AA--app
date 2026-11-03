import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getLucrari, getNoteNoiDeLaMedici, getProductieTehnician } from './services/dataService'
import { getSession, getProfile, onAuthStateChange, signOut } from './services/auth'
import { subscribeToTable } from './services/realtime'
import { bazaCaz, urmatorulNrInCaz } from './utils/caz'
import { esteTehnician as rolTehnician, estePatron, esteMedic, areAccesOperational } from './utils/roluri'
import Sidebar from './components/Sidebar.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import LucrariList from './components/LucrariList.jsx'
import LucrareModal from './components/LucrareModal.jsx'
import LucrareDetailPanel from './components/LucrareDetailPanel.jsx'
import CautareGlobala from './components/CautareGlobala.jsx'
import SetupPage from './components/SetupPage.jsx'
import TaskuriPage from './components/TaskuriPage.jsx'
import CapacitatePage from './components/CapacitatePage.jsx'
import SalariiPage from './components/SalariiPage.jsx'
import FinanciarPage from './components/FinanciarPage.jsx'
import TaskurileMelePage from './components/TaskurileMelePage.jsx'
import SalariulMeuPage from './components/SalariulMeuPage.jsx'
import MedicApp from './components/MedicApp.jsx'
import NeconformitatiPage from './components/NeconformitatiPage.jsx'
import FurnizoriPage from './components/FurnizoriPage.jsx'
import GhidPage from './components/GhidPage.jsx'
import ObiectivePage from './components/ObiectivePage.jsx'
import { AjutorProvider } from './ajutor/Ajutor.jsx'
import './App.css'

function AppContent({ profile, onSignOut }) {
  const { nrInregistrare } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const esteTehnician = rolTehnician(profile)
  // Financiar și Salarii — doar patronul (coordonatorul vede restul aplicației).
  const accesFinanciar = estePatron(profile)

  const [pagina, setPagina] = useState(esteTehnician ? 'task-urile-mele' : 'dashboard')
  // Setup are rute proprii (/setup/<secțiune>); celelalte pagini rămân pe stare.
  const laSetup = !esteTehnician && (location.pathname === '/setup' || location.pathname.startsWith('/setup/'))
  const paginaActiva = laSetup ? 'setup' : pagina
  const navigheazaPagina = useCallback(
    (id) => {
      if (id === 'setup') {
        navigate('/setup')
        return
      }
      setPagina(id)
      if (laSetup) navigate('/')
    },
    [navigate, laSetup]
  )
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  // „Încă o lucrare pe acest caz": datele precompletate din fișa curentă.
  const [cazNou, setCazNou] = useState(null)
  // Note de la medici necitite încă de laborator (patron/coordonator) —
  // indicator pe Listă/Kanban și secțiune pe Dashboard.
  const [noteNoi, setNoteNoi] = useState([])
  const vedeNoteNoi = areAccesOperational(profile)
  // Neconformitate pornită din tabul Note al unei comenzi (mesajul medicului).
  const [precompletareNc, setPrecompletareNc] = useState(null)
  const golestePrecompletareNc = useCallback(() => setPrecompletareNc(null), [])
  const deschideFisa = useCallback(
    (lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`),
    [navigate]
  )
  const neconformitateDinNota = useCallback(
    ({ lucrare, nota }) => {
      setPrecompletareNc({ tip: 'reclamatie_medic', comanda_id: lucrare.id, descriere: nota.text, nota_id: nota.id })
      setPagina('neconformitati')
      navigate('/')
    },
    [navigate]
  )

  // Tehnicianul vede toate lucrările în Listă/Kanban, dar poate raporta o
  // neconformitate doar pe ale lui — ID-urile lucrărilor în care are o etapă.
  const [idsLucrariMele, setIdsLucrariMele] = useState(null)
  const tehnicianId = profile.tehnician_id
  useEffect(() => {
    if (!esteTehnician || !tehnicianId) return undefined
    const incarca = async () => {
      try {
        const randuri = await getProductieTehnician(tehnicianId)
        setIdsLucrariMele(new Set(randuri.map((r) => r.lucrare_id)))
      } catch {
        setIdsLucrariMele(new Set())
      }
    }
    incarca()
    return subscribeToTable('productie_lucrare', incarca)
  }, [esteTehnician, tehnicianId])
  const lucrariMele = useMemo(
    () => (idsLucrariMele ? lucrari.filter((l) => idsLucrariMele.has(l.id)) : []),
    [lucrari, idsLucrariMele]
  )

  const adaugaInCaz = useCallback(
    (lucrare) => {
      const baza = bazaCaz(lucrare)
      setCazNou({
        caz_id: baza,
        nr_inregistrare: urmatorulNrInCaz(lucrari, baza),
        clinica: lucrare.clinica,
        medic: lucrare.medic,
        pacient: lucrare.pacient,
        data_intrare: lucrare.data_intrare,
        termen_predare: lucrare.termen_predare,
      })
    },
    [lucrari]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getLucrari()
    setLucrari(data)
    setLoading(false)
  }, [])

  // Reîmprospătare „tăcută" (fără ecranul de loading) — folosită de
  // Realtime, ca o lucrare adăugată/ștearsă/modificată de altcineva să
  // apară singură, fără să clipească interfața la fiecare eveniment.
  const refreshSilent = useCallback(async () => {
    setLucrari(await getLucrari())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const unsubscribe = subscribeToTable('lucrari', () => refreshSilent())
    return unsubscribe
  }, [refreshSilent])

  const reincarcaNoteNoi = useCallback(async () => {
    if (vedeNoteNoi) setNoteNoi(await getNoteNoiDeLaMedici())
  }, [vedeNoteNoi])

  useEffect(() => {
    if (!vedeNoteNoi) return undefined
    reincarcaNoteNoi()
    return subscribeToTable('note_comanda', () => reincarcaNoteNoi())
  }, [vedeNoteNoi, reincarcaNoteNoi])

  // Fiecare lucrare primește `note_noi_medic` (numărul notelor necitite).
  const lucrariCuNote = useMemo(() => {
    if (noteNoi.length === 0) return lucrari
    const nr = new Map()
    for (const n of noteNoi) nr.set(n.comanda_id, (nr.get(n.comanda_id) || 0) + 1)
    return lucrari.map((l) => (nr.has(l.id) ? { ...l, note_noi_medic: nr.get(l.id) } : l))
  }, [lucrari, noteNoi])

  const editing = nrInregistrare
    ? lucrariCuNote.find((l) => l.nr_inregistrare === nrInregistrare) || null
    : null

  return (
    <div className="app-shell">
      <Sidebar activePage={paginaActiva} onNavigate={navigheazaPagina} profile={profile} onSignOut={onSignOut} />

      <main className="app-main">
        {!esteTehnician && (
          <header className="app-header">
            <CautareGlobala
              lucrari={lucrariCuNote}
              onSelect={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
            />
          </header>
        )}
        <div className="app-main-inner">
          {esteTehnician ? (
            paginaActiva === 'salariul-meu' ? (
              <SalariulMeuPage />
            ) : paginaActiva === 'lista' ? (
              <LucrariList
                lucrari={lucrari}
                loading={loading}
                onDataChanged={refresh}
                onRowClick={deschideFisa}
                readOnly
              />
            ) : paginaActiva === 'neconformitati' ? (
              <NeconformitatiPage profile={profile} lucrari={lucrariMele} onOpenLucrare={deschideFisa} />
            ) : paginaActiva === 'ghid' ? (
              <GhidPage />
            ) : (
              <TaskurileMelePage tehnicianId={profile.tehnician_id} />
            )
          ) : (
            <>
              {paginaActiva === 'dashboard' && (
                <Dashboard
                  lucrari={lucrariCuNote}
                  loading={loading}
                  noteNoi={vedeNoteNoi ? noteNoi : null}
                  onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                  onOpenNote={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}?tab=note`)}
                />
              )}
              {paginaActiva === 'lista' && (
                <LucrariList
                  lucrari={lucrariCuNote}
                  loading={loading}
                  onDataChanged={refresh}
                  onRowClick={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                  onNewLucrare={() => setCreating(true)}
                />
              )}
              {paginaActiva === 'setup' && <SetupPage profile={profile} onDataChanged={refresh} />}
              {paginaActiva === 'taskuri' && <TaskuriPage profile={profile} />}
              {paginaActiva === 'capacitate' && <CapacitatePage />}
              {paginaActiva === 'neconformitati' && (
                <NeconformitatiPage
                  profile={profile}
                  lucrari={lucrari}
                  precompletare={precompletareNc}
                  onPrecompletareFolosita={golestePrecompletareNc}
                  onOpenLucrare={deschideFisa}
                />
              )}
              {paginaActiva === 'furnizori' && <FurnizoriPage />}
              {paginaActiva === 'ghid' && <GhidPage />}
              {paginaActiva === 'obiective' && accesFinanciar && <ObiectivePage />}
              {paginaActiva === 'salarii' && accesFinanciar && (
                <SalariiPage
                  onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                />
              )}
              {paginaActiva === 'financiar-rapoarte' && accesFinanciar && (
                <FinanciarPage
                  onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {!esteTehnician && creating && (
        <LucrareModal
          profile={profile}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      )}

      {editing && (
        <LucrareDetailPanel
          key={editing.id}
          lucrare={editing}
          profile={profile}
          tabInitial={searchParams.get('tab')}
          onClose={() => navigate('/')}
          onUpdated={refresh}
          onNoteCitite={reincarcaNoteNoi}
          onNeconformitate={areAccesOperational(profile) ? neconformitateDinNota : undefined}
          lucrariToate={lucrari}
          onDeschideLucrare={deschideFisa}
          onAdaugaInCaz={esteTehnician ? undefined : adaugaInCaz}
        />
      )}

      {!esteTehnician && cazNou && (
        <LucrareModal
          profile={profile}
          precompletare={cazNou}
          onClose={() => setCazNou(null)}
          onSaved={async (creata) => {
            setCazNou(null)
            await refresh()
            if (creata?.nr_inregistrare) deschideFisa(creata)
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const paginaMedic = location.pathname === '/medic' || location.pathname.startsWith('/medic/')
  // `undefined` = încă se verifică sesiunea; `null` = neautentificat.
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let activ = true
    getSession().then((s) => {
      if (activ) setSession(s)
    })
    const unsubscribe = onAuthStateChange((s) => {
      if (activ) setSession(s)
    })
    return () => {
      activ = false
      unsubscribe()
    }
  }, [])

  // Cheia efectului e `session?.user?.id`, NU obiectul `session` întreg —
  // Supabase reemite sesiunea (obiect nou, același utilizator) la reluarea
  // focusului pe tab (ex. revii de pe alt tab din Chrome), ca să reîmprospăteze
  // token-ul. Dacă am ține cont de fiecare astfel de eveniment, am reface
  // fetch-ul de profil și am arăta din nou ecranul de „Se încarcă profilul”,
  // ceea ce demontează <AppContent> și resetează navigarea la Dashboard.
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    let activ = true
    setProfileLoading(true)
    getProfile(userId)
      .then((p) => {
        if (activ) setProfile(p)
      })
      .finally(() => {
        if (activ) setProfileLoading(false)
      })
    return () => {
      activ = false
    }
  }, [userId])

  // Pagina medicului are propria autentificare (cod pe email) și nu folosește
  // nimic din interfața laboratorului.
  if (paginaMedic) return <MedicApp session={session} profile={profile} profileLoading={profileLoading} />

  if (session === undefined) {
    return (
      <div className="auth-status-screen">
        <div className="card auth-status-card">
          <p>Se verifică sesiunea…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (profileLoading && !profile) {
    return (
      <div className="auth-status-screen">
        <div className="card auth-status-card">
          <p>Se încarcă profilul…</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="auth-status-screen">
        <div className="card auth-status-card">
          <p>Contul tău e autentificat, dar nu are încă un rol asignat. Cere administratorului să-ți creeze un profil.</p>
          <button type="button" className="btn btn-secondary" onClick={() => signOut()}>
            Deconectare
          </button>
        </div>
      </div>
    )
  }

  if (esteMedic(profile)) return <Navigate to="/medic" replace />

  return (
    <AjutorProvider profile={profile}>
      <Routes>
        <Route path="/" element={<AppContent profile={profile} onSignOut={signOut} />} />
        <Route path="/comanda/:nrInregistrare" element={<AppContent profile={profile} onSignOut={signOut} />} />
        <Route path="/setup/*" element={<AppContent profile={profile} onSignOut={signOut} />} />
      </Routes>
    </AjutorProvider>
  )
}
