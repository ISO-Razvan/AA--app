import { useEffect, useState } from 'react'
import { getTehnicieni, getEtapeProductie } from '../services/dataService'
import TaskuriTehnicianModal from './TaskuriTehnicianModal.jsx'
import './TaskuriPage.css'

function initiale(nume) {
  return (nume || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
}

export default function TaskuriPage() {
  const [tehnicieni, setTehnicieni] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectat, setSelectat] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, e] = await Promise.all([getTehnicieni(), getEtapeProductie()])
      setTehnicieni(t)
      setEtape(e)
      setLoading(false)
    }
    load()
  }, [])

  const etapaById = (id) => etape.find((e) => e.id === id)

  return (
    <div className="taskuri-page">
      <h2>Task-uri</h2>
      <p className="taskuri-page-hint">Alege un tehnician ca să vezi sarcinile lui programate pentru o zi.</p>

      {loading ? (
        <p className="taskuri-loading">Se încarcă…</p>
      ) : tehnicieni.length === 0 ? (
        <div className="card taskuri-empty">
          <p>Niciun tehnician înregistrat încă. Adaugă tehnicieni din Setup → Tehnicieni.</p>
        </div>
      ) : (
        <ul className="taskuri-grid">
          {tehnicieni.map((t) => (
            <li key={t.id}>
              <button type="button" className="card taskuri-tehnician-card" onClick={() => setSelectat(t)}>
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
      )}

      {selectat && <TaskuriTehnicianModal tehnician={selectat} onClose={() => setSelectat(null)} />}
    </div>
  )
}
