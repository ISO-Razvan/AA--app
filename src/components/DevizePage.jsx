import { useEffect, useState } from 'react'
import { getDevize, deleteDeviz } from '../services/dataService'
import { formatSuma } from './SalariiPage.jsx'
import DevizNouModal from './DevizNouModal.jsx'
import DevizPreview from './DevizPreview.jsx'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './DevizePage.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function IconStergere() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 4.5V3.2C6 2.65 6.45 2.2 7 2.2H9C9.55 2.2 10 2.65 10 3.2V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4.5L5 12.7C5.03 13.28 5.5 13.73 6.08 13.73H9.92C10.5 13.73 10.97 13.28 11 12.7L11.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DevizePage() {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [devize, setDevize] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [previewDeviz, setPreviewDeviz] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    setDevize(await getDevize())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleGenerated = async (deviz) => {
    setCreating(false)
    await load()
    setPreviewDeviz(deviz)
  }

  const handleDelete = async (deviz, e) => {
    e.stopPropagation()
    const ok = await confirm(
      `Ștergi definitiv devizul ${deviz.numar_deviz} (${deviz.medic})? Lucrările incluse redevin disponibile pentru un deviz nou. Acțiunea nu poate fi anulată.`,
      { title: 'Ștergi devizul?', confirmLabel: 'Șterge', danger: true }
    )
    if (!ok) return
    setDeletingId(deviz.id)
    try {
      await deleteDeviz(deviz.id)
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="devize-page">
      <div className="devize-page-toolbar">
        <p className="devize-page-count">
          {loading ? 'Se încarcă…' : `${devize.length} ${devize.length === 1 ? 'deviz generat' : 'devize generate'}`}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + Deviz nou
        </button>
      </div>

      {!loading && devize.length === 0 && (
        <div className="card devize-empty">
          <p>Niciun deviz generat încă.</p>
        </div>
      )}

      {devize.length > 0 && (
        <div className="card devize-table-wrap">
          <table className="devize-table">
            <thead>
              <tr>
                <th>Număr</th>
                <th>Medic</th>
                <th>Clinică</th>
                <th>Dată</th>
                <th>Total</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {devize.map((d) => (
                <tr key={d.id} className="devize-table-row" onClick={() => setPreviewDeviz(d)} tabIndex={0}>
                  <td className="devize-table-nr">{d.numar_deviz}</td>
                  <td>{d.medic}</td>
                  <td>{d.clinica || '—'}</td>
                  <td>{formatData(d.data_generare)}</td>
                  <td className="devize-table-suma">{formatSuma(d.total)}</td>
                  <td>
                    <button
                      type="button"
                      className="devize-delete-btn"
                      onClick={(e) => handleDelete(d, e)}
                      disabled={deletingId === d.id}
                      aria-label={`Șterge devizul ${d.numar_deviz}`}
                      title="Șterge devizul"
                    >
                      <IconStergere />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <DevizNouModal onClose={() => setCreating(false)} onGenerated={handleGenerated} />}

      {previewDeviz && <DevizPreview deviz={previewDeviz} onClose={() => setPreviewDeviz(null)} />}

      {confirmDialog}
    </div>
  )
}
