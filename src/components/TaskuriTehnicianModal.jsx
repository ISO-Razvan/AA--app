import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TaskuriTehnicianContent from './TaskuriTehnicianContent.jsx'
import './TaskuriTehnicianModal.css'

export default function TaskuriTehnicianModal({ tehnician, onClose, initialDate }) {
  const navigate = useNavigate()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleOpenLucrare = (lucrare) => {
    onClose()
    navigate(`/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="taskuri-modal" role="dialog" aria-modal="true" aria-label={`Task-uri ${tehnician.nume}`}>
        <header className="taskuri-modal-header">
          <h2>{tehnician.nume}</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        </header>

        <div className="taskuri-modal-body">
          <TaskuriTehnicianContent tehnician={tehnician} initialDate={initialDate} onOpenLucrare={handleOpenLucrare} />
        </div>
      </div>
    </div>
  )
}
