import { useEffect, useState } from 'react'
import {
  getEtapeProductie,
  getTehnicieni,
  addTehnician,
  updateTehnician,
  deleteTehnician,
} from '../services/dataService'
import './TehnicieniList.css'

const FORM_INIT = { nume: '', roluri: [] }

export default function TehnicieniList({ etapeRefreshSignal }) {
  const [tehnicieni, setTehnicieni] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null) // null | 'new' | id
  const [form, setForm] = useState(FORM_INIT)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [t, e] = await Promise.all([getTehnicieni(), getEtapeProductie()])
    setTehnicieni(t)
    setEtape(e)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapeRefreshSignal])

  const etapaById = (id) => etape.find((e) => e.id === id)

  const startAdd = () => {
    setEditingId('new')
    setForm(FORM_INIT)
    setError('')
  }

  const startEdit = (tehnician) => {
    setEditingId(tehnician.id)
    setForm({ nume: tehnician.nume, roluri: tehnician.roluri || [] })
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(FORM_INIT)
    setError('')
  }

  const toggleRol = (etapaId) => {
    setForm((prev) => ({
      ...prev,
      roluri: prev.roluri.includes(etapaId)
        ? prev.roluri.filter((id) => id !== etapaId)
        : [...prev.roluri, etapaId],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nume.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      if (editingId === 'new') {
        await addTehnician({ nume: form.nume.trim(), roluri: form.roluri })
      } else {
        await updateTehnician(editingId, { nume: form.nume.trim(), roluri: form.roluri })
      }
      cancelEdit()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteTehnician(id)
    if (editingId === id) cancelEdit()
    await load()
  }

  return (
    <div className="card tehnicieni-card">
      <div className="tehnicieni-header">
        <h3>Tehnicieni</h3>
        <p>Fiecare tehnician poate avea unul sau mai multe roluri, alese dintre etapele de producție definite mai sus.</p>
      </div>

      {loading ? (
        <p className="tehnicieni-loading">Se încarcă…</p>
      ) : (
        <ul className="tehnicieni-list">
          {tehnicieni.map((t) => (
            <li key={t.id} className="tehnicieni-row">
              <div className="tehnicieni-row-main">
                <span className="tehnicieni-nume">{t.nume}</span>
                <div className="tehnicieni-badges">
                  {t.roluri.length === 0 && <span className="tehnicieni-badge-empty">Fără rol încă</span>}
                  {t.roluri.map((id) => {
                    const etapa = etapaById(id)
                    return etapa ? (
                      <span key={id} className="badge-rol">
                        {etapa.nume}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
              <div className="tehnicieni-actions">
                <button type="button" className="btn btn-ghost" onClick={() => startEdit(t)}>
                  Editează
                </button>
                <button
                  type="button"
                  className="btn btn-ghost tehnicieni-delete-btn"
                  onClick={() => handleDelete(t.id)}
                >
                  Șterge
                </button>
              </div>
            </li>
          ))}
          {tehnicieni.length === 0 && editingId !== 'new' && (
            <li className="tehnicieni-empty">Niciun tehnician adăugat încă.</li>
          )}
        </ul>
      )}

      {editingId ? (
        <form className="tehnicieni-form" onSubmit={handleSubmit}>
          <div>
            <label className="field-label">Nume tehnician</label>
            <input
              type="text"
              className="text-input"
              placeholder="Nume și prenume"
              value={form.nume}
              onChange={(e) => setForm((prev) => ({ ...prev, nume: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <span className="field-label">Roluri</span>
            {etape.length === 0 ? (
              <p className="tehnicieni-no-etape">Definește mai întâi cel puțin o etapă de producție.</p>
            ) : (
              <div className="tehnicieni-roluri-grid">
                {etape.map((etapa) => (
                  <label key={etapa.id} className="tehnicieni-rol-option">
                    <input
                      type="checkbox"
                      checked={form.roluri.includes(etapa.id)}
                      onChange={() => toggleRol(etapa.id)}
                    />
                    {etapa.nume}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="tehnicieni-error">{error}</p>}

          <div className="tehnicieni-form-actions">
            <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
              Anulează
            </button>
            <button type="submit" className="btn btn-primary" disabled={!form.nume.trim() || saving}>
              {saving ? 'Se salvează…' : editingId === 'new' ? '+ Adaugă tehnician' : 'Salvează modificările'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary tehnicieni-add-btn" onClick={startAdd}>
          + Adaugă tehnician
        </button>
      )}
    </div>
  )
}
