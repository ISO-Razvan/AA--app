import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getLucrari, getNoteNoiDeLaMedici } from './services/dataService'
import { getSession, getProfile, onAuthStateChange, signOut } from './services/auth'
import { subscribeToTable } from './services/realtime'
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
import { AjutorProvider } from './ajutor/Ajutor.jsx'
import './App.css'

function AppContent({ profile, onSignOut }) {
  const { nrInregistrare } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const esteTehnician = rolTehnician(profile)
  // Financiar și Salarii — doar patronul (coordonatorul vede restul aplicației).
  const accesFinanciar = estePatron(profile)

  const [pagina, setPagina] = useState(esteTehnician ? 'task-urile-mele' : 'dashboard')
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
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
      <Sidebar activePage={pagina} onNavigate={setPagina} profile={profile} onSignOut={onSignOut} />

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
            pagina === 'salariul-meu' ? (
              <SalariulMeuPage />
            ) : pagina === 'neconformitati' ? (
              <NeconformitatiPage profile={profile} lucrari={lucrari} onOpenLucrare={deschideFisa} />
            ) : pagina === 'ghid' ? (
              <GhidPage />
            ) : (
              <TaskurileMelePage tehnicianId={profile.tehnician_id} />
            )
          ) : (
            <>
              {pagina === 'dashboard' && (
                <Dashboard
                  lucrari={lucrariCuNote}
                  loading={loading}
                  noteNoi={vedeNoteNoi ? noteNoi : null}
                  onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                  onOpenNote={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}?tab=note`)}
                />
              )}
              {pagina === 'lista' && (
                <LucrariList
                  lucrari={lucrariCuNote}
                  loading={loading}
                  onDataChanged={refresh}
                  onRowClick={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                  onNewLucrare={() => setCreating(true)}
                />
              )}
              {pagina === 'setup' && <SetupPage profile={profile} onDataChanged={refresh} />}
              {pagina === 'taskuri' && <TaskuriPage />}
              {pagina === 'capacitate' && <CapacitatePage />}
              {pagina === 'neconformitati' && (
                <NeconformitatiPage
                  profile={profile}
                  lucrari={lucrari}
                  precompletare={precompletareNc}
                  onPrecompletareFolosita={golestePrecompletareNc}
                  onOpenLucrare={deschideFisa}
                />
              )}
              {pagina === 'furnizori' && <FurnizoriPage />}
              {pagina === 'ghid' && <GhidPage />}
              {pagina === 'salarii' && accesFinanciar && (
                <SalariiPage
                  onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
                />
              )}
              {pagina === 'financiar-rapoarte' && accesFinanciar && (
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
      </Routes>
    </AjutorProvider>
  )
}
