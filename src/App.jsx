import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { getLucrari } from './services/dataService'
import { getSession, getProfile, onAuthStateChange, signOut } from './services/auth'
import Sidebar from './components/Sidebar.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import LucrariList from './components/LucrariList.jsx'
import LucrareModal from './components/LucrareModal.jsx'
import LucrareDetailPanel from './components/LucrareDetailPanel.jsx'
import SetupPage from './components/SetupPage.jsx'
import TaskuriPage from './components/TaskuriPage.jsx'
import CapacitatePage from './components/CapacitatePage.jsx'
import SalariiPage from './components/SalariiPage.jsx'
import './App.css'

function AppContent({ profile, onSignOut }) {
  const { nrInregistrare } = useParams()
  const navigate = useNavigate()

  const [pagina, setPagina] = useState('dashboard')
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getLucrari()
    setLucrari(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const editing = nrInregistrare
    ? lucrari.find((l) => l.nr_inregistrare === nrInregistrare) || null
    : null

  return (
    <div className="app-shell">
      <Sidebar activePage={pagina} onNavigate={setPagina} profile={profile} onSignOut={onSignOut} />

      <main className="app-main">
        <div className="app-main-inner">
          {pagina === 'dashboard' && (
            <Dashboard
              lucrari={lucrari}
              loading={loading}
              onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
            />
          )}
          {pagina === 'lista' && (
            <LucrariList
              lucrari={lucrari}
              loading={loading}
              onDataChanged={refresh}
              onRowClick={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
              onNewLucrare={() => setCreating(true)}
            />
          )}
          {pagina === 'setup' && <SetupPage />}
          {pagina === 'taskuri' && <TaskuriPage />}
          {pagina === 'capacitate' && <CapacitatePage />}
          {pagina === 'salarii' && (
            <SalariiPage
              onOpenLucrare={(lucrare) => navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)}
            />
          )}
        </div>
      </main>

      {creating && (
        <LucrareModal
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
          onClose={() => navigate('/')}
          onUpdated={refresh}
        />
      )}
    </div>
  )
}

export default function App() {
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

  return (
    <Routes>
      <Route path="/" element={<AppContent profile={profile} onSignOut={signOut} />} />
      <Route path="/comanda/:nrInregistrare" element={<AppContent profile={profile} onSignOut={signOut} />} />
    </Routes>
  )
}
