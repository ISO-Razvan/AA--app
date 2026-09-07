import { useEffect, useState } from 'react'
import {
  getEtapeProductie,
  addEtapaProductie,
  deleteEtapaProductie,
  reordoneazaEtapeProductie,
  updateEtapaDurata,
} from '../services/dataService'
import './EtapeProductieList.css'

export default function EtapeProductieList({ onChange }) {
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [nume, setNume] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setEtape(await getEtapeProductie())
    setLoading(false)
    onChange?.()
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!nume.trim() || saving) return
    setSaving(true)
    setError('')
    try {
      await addEtapaProductie(nume.trim())
      setNume('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteEtapaProductie(id)
    await load()
  }

  const handleMove = async (index, directie) => {
    const target = index + directie
    if (target < 0 || target >= etape.length) return
    const ids = etape.map((e) => e.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(target, 0, moved)
    await reordoneazaEtapeProductie(ids)
    await load()
  }

  const handleDurataChange = (id, valoare) => {
    setEtape((prev) => prev.map((e) => (e.id === id ? { ...e, durata_minute: valoare } : e)))
  }

  const handleDurataBlur = async (etapa) => {
    await updateEtapaDurata(etapa.id, etapa.durata_minute)
    await load()
  }

  return (
    <div className="card etape-card">
      <div className="etape-header">
        <h3>Etape de producție</h3>
        <p>
          Ordinea de mai jos va fi folosită pentru programarea etapei de producție a unei lucrări. Durata estimată
          per element ajută la calculul orelor de muncă alocate unui tehnician (nr. elemente × durata etapei).
        </p>
      </div>

      {loading ? (
        <p className="etape-loading">Se încarcă…</p>
      ) : (
        <ul className="etape-list">
          {etape.map((etapa, i) => (
            <li key={etapa.id} className="etape-row">
              <div className="etape-row-top">
                <span className="etape-order">{i + 1}</span>
                <span className="etape-nume">{etapa.nume}</span>
                <div className="etape-actions">
                  <button
                    type="button"
                    className="btn btn-ghost etape-move-btn"
                    onClick={() => handleMove(i, -1)}
                    disabled={i === 0}
                    aria-label={`Mută „${etapa.nume}” mai sus`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost etape-move-btn"
                    onClick={() => handleMove(i, 1)}
                    disabled={i === etape.length - 1}
                    aria-label={`Mută „${etapa.nume}” mai jos`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost etape-delete-btn"
                    onClick={() => handleDelete(etapa.id)}
                    aria-label={`Șterge „${etapa.nume}”`}
                  >
                    Șterge
                  </button>
                </div>
              </div>
              <div className="etape-durata">
                <label className="etape-durata-label" htmlFor={`durata-${etapa.id}`}>
                  Durată estimată per element
                </label>
                <div className="etape-durata-input-wrap">
                  <input
                    id={`durata-${etapa.id}`}
                    type="number"
                    min="0"
                    step="1"
                    className="text-input etape-durata-input"
                    value={etapa.durata_minute}
                    onChange={(e) => handleDurataChange(etapa.id, e.target.value)}
                    onBlur={() => handleDurataBlur(etapa)}
                  />
                  <span className="etape-durata-unit">min</span>
                </div>
              </div>
            </li>
          ))}
          {etape.length === 0 && <li className="etape-empty">Nicio etapă definită încă.</li>}
        </ul>
      )}

      <form className="etape-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          className="text-input"
          placeholder="Nume etapă nouă…"
          value={nume}
          onChange={(e) => setNume(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!nume.trim() || saving}>
          {saving ? 'Se adaugă…' : '+ Adaugă etapă'}
        </button>
      </form>
      {error && <p className="etape-error">{error}</p>}
    </div>
  )
}
