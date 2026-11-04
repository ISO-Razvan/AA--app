import { useEffect, useState } from 'react'
import {
  getEtapeProductie,
  addEtapaProductie,
  deleteEtapaProductie,
  reordoneazaEtapeProductie,
  updateEtapaDurata,
  redenumesteEtapaProductie,
  seteazaEtapaValidare,
} from '../services/dataService'
import { motivBlocareRedenumire } from '../utils/etapaProductie'
import './EtapeProductieList.css'

export default function EtapeProductieList({ onChange }) {
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [nume, setNume] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  // Redenumirea: o singură etapă o dată, direct în rând.
  const [editId, setEditId] = useState(null)
  const [numeEditat, setNumeEditat] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

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

  const pornesteRedenumirea = (etapa) => {
    setEditId(etapa.id)
    setNumeEditat(etapa.nume)
    setEditError('')
  }

  const anuleazaRedenumirea = () => {
    setEditId(null)
    setEditError('')
  }

  const salveazaRedenumirea = async (etapa) => {
    if (editSaving) return
    const valoare = numeEditat.trim()
    if (!valoare) {
      setEditError('Numele etapei nu poate fi gol.')
      return
    }
    if (valoare === etapa.nume) {
      anuleazaRedenumirea()
      return
    }
    if (etape.some((e) => e.id !== etapa.id && e.nume.trim().toLowerCase() === valoare.toLowerCase())) {
      setEditError(`Există deja o etapă cu numele „${valoare}”.`)
      return
    }
    setEditSaving(true)
    setEditError('')
    try {
      await redenumesteEtapaProductie(etapa.id, valoare)
      setEditId(null)
      await load()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  // „Etapă de validare": cod stabil în baza de date (nu nume), ca etapa să poată fi redenumită.
  const handleValidare = async (etapa, activ) => {
    setError('')
    try {
      await seteazaEtapaValidare(etapa.id, activ)
      await load()
    } catch (err) {
      setError(err.message)
    }
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

      <div className="etape-columns">
        <div className="etape-list-col">
          {loading ? (
            <p className="etape-loading">Se încarcă…</p>
          ) : (
            <ul className="etape-list">
              {etape.map((etapa, i) => {
                const editeaza = editId === etapa.id
                const esteValidare = etapa.cod === 'validare'
                // Validare se identifică prin cod, deci se poate redenumi; Model/Design/Livrare nu.
                const motivSistem = motivBlocareRedenumire(etapa.nume)
                const motivBlocat = esteValidare ? null : motivSistem
                return (
                <li key={etapa.id} className="etape-row">
                  <div className="etape-row-top">
                    <span className="etape-order">{i + 1}</span>
                    {editeaza ? (
                      <input
                        type="text"
                        className="text-input etape-nume-input"
                        value={numeEditat}
                        onChange={(e) => {
                          setNumeEditat(e.target.value)
                          setEditError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            salveazaRedenumirea(etapa)
                          } else if (e.key === 'Escape') {
                            anuleazaRedenumirea()
                          }
                        }}
                        aria-label={`Numele etapei „${etapa.nume}”`}
                        autoFocus
                        disabled={editSaving}
                      />
                    ) : (
                      <span className="etape-nume">
                        {etapa.nume}
                        {esteValidare && <span className="etape-badge-validare" title="Etapa în care designerul trimite lucrările la validare">Validare</span>}
                      </span>
                    )}
                    {editeaza ? (
                      <div className="etape-actions">
                        <button
                          type="button"
                          className="btn btn-primary etape-edit-save"
                          onClick={() => salveazaRedenumirea(etapa)}
                          disabled={editSaving}
                        >
                          {editSaving ? 'Se salvează…' : 'Salvează'}
                        </button>
                        <button type="button" className="btn btn-ghost etape-edit-cancel" onClick={anuleazaRedenumirea} disabled={editSaving}>
                          Anulează
                        </button>
                      </div>
                    ) : (
                    <div className="etape-actions">
                      <button
                        type="button"
                        className="btn btn-ghost etape-move-btn"
                        onClick={() => pornesteRedenumirea(etapa)}
                        disabled={!!motivBlocat || editId !== null}
                        title={motivBlocat ? `Nu se poate redenumi: ${motivBlocat}` : 'Redenumește'}
                        aria-label={`Redenumește „${etapa.nume}”`}
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11.2 2.3a1.6 1.6 0 012.3 2.3L5.4 12.7l-3.1.8.8-3.1 8.1-8.1z" />
                        </svg>
                      </button>
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
                        className="btn btn-outline-danger etape-delete-btn"
                        onClick={() => handleDelete(etapa.id)}
                        aria-label={`Șterge „${etapa.nume}”`}
                      >
                        Șterge
                      </button>
                    </div>
                    )}
                  </div>
                  {editeaza && editError && <p className="etape-error etape-edit-error">{editError}</p>}
                  {!motivSistem && (
                    <label className="etape-validare-toggle">
                      <input type="checkbox" checked={esteValidare} onChange={(e) => handleValidare(etapa, e.target.checked)} />
                      <span>Etapă de validare — designerul trimite aici lucrările, fără să finalizeze designul</span>
                    </label>
                  )}
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
                )
              })}
              {etape.length === 0 && <li className="etape-empty">Nicio etapă definită încă.</li>}
            </ul>
          )}
        </div>

        <div className="etape-form-col">
          <form className="etape-add-form" onSubmit={handleAdd}>
            <label className="field-label" htmlFor="etapa-nume-noua">Etapă nouă</label>
            <input
              id="etapa-nume-noua"
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
      </div>
    </div>
  )
}
