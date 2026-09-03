import { useCallback, useEffect, useState } from 'react'
import { getLucrari } from './services/dataService'
import LucrariList from './components/LucrariList.jsx'
import LucrareModal from './components/LucrareModal.jsx'
import './App.css'

export default function App() {
  const [lucrari, setLucrari] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await getLucrari()
    setLucrari(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-logo-dot" aria-hidden="true" />
          <div>
            <h1>Algorithm Aesthetics</h1>
            <p>Registru lucrări laborator</p>
          </div>
        </div>
        <nav className="app-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + Înregistrare lucrare
          </button>
        </nav>
      </header>

      <main className="app-main">
        <LucrariList
          lucrari={lucrari}
          loading={loading}
          onDataChanged={refresh}
          onRowClick={(lucrare) => setEditing(lucrare)}
        />
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
        <LucrareModal
          key={editing.id}
          lucrare={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}
