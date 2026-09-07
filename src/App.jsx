import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { getLucrari } from './services/dataService'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import LucrariList from './components/LucrariList.jsx'
import LucrareModal from './components/LucrareModal.jsx'
import LucrareDetailPanel from './components/LucrareDetailPanel.jsx'
import SetupPage from './components/SetupPage.jsx'
import TaskuriPage from './components/TaskuriPage.jsx'
import CapacitatePage from './components/CapacitatePage.jsx'
import SalariiPage from './components/SalariiPage.jsx'
import './App.css'

function AppContent() {
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
      <Sidebar activePage={pagina} onNavigate={setPagina} />

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
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/comanda/:nrInregistrare" element={<AppContent />} />
    </Routes>
  )
}
