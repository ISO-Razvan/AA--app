import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTehnicieni } from '../services/dataService'
import TaskuriTehnicianContent from './TaskuriTehnicianContent.jsx'
import './TaskurileMelePage.css'

// Vederea restrânsă a tehnicianului logat — același conținut (calendar +
// listă + bifare + print) ca modalul de manager, dar blocat pe tehnicianul
// legat de contul curent (`profile.tehnician_id`), ca pagină, nu ca modal.
export default function TaskurileMelePage({ tehnicianId }) {
  const navigate = useNavigate()
  const [tehnician, setTehnician] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const toti = await getTehnicieni()
      setTehnician(toti.find((t) => t.id === tehnicianId) || null)
      setLoading(false)
    }
    load()
  }, [tehnicianId])

  const handleOpenLucrare = (lucrare) => {
    navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)
  }

  return (
    <div className="taskurile-mele-page">
      <h2>Task-urile mele</h2>
      <p className="taskurile-mele-hint">Sarcinile tale de producție, zi de zi.</p>

      {loading ? (
        <p className="taskurile-mele-status">Se încarcă…</p>
      ) : !tehnician ? (
        <div className="card taskurile-mele-empty">
          <p>Contul tău nu este încă legat de un tehnician. Cere administratorului să completeze acest cont din Supabase.</p>
        </div>
      ) : (
        <div className="card taskurile-mele-card">
          <TaskuriTehnicianContent tehnician={tehnician} onOpenLucrare={handleOpenLucrare} />
        </div>
      )}
    </div>
  )
}
