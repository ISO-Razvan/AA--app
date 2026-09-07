import { useEffect, useState } from 'react'
import {
  getTipuriLucrareDetaliate,
  updateTipLucrareCosturi,
  addTipLucrare,
  renameTipLucrare,
  deleteTipLucrare,
} from '../services/dataService'
import './TipuriLucrareCosturi.css'

function formatRON(valoare) {
  const n = Number(valoare) || 0
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TipuriLucrareCosturi({ onChange }) {
  const [tipuri, setTipuri] = useState([])
  const [loading, setLoading] = useState(true)
  const [numeNou, setNumeNou] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setTipuri(await getTipuriLucrareDetaliate())
    setLoading(false)
    onChange?.()
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (id, field, valoare) => {
    setTipuri((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: valoare } : t)))
  }

  const handleBlurCosturi = async (tip) => {
    await updateTipLucrareCosturi(tip.id, {
      cost_laborator: tip.cost_laborator,
      incasare: tip.incasare,
    })
  }

  const handleBlurNume = async (tip) => {
    setError('')
    try {
      await renameTipLucrare(tip.id, tip.nume)
      await load()
    } catch (err) {
      setError(err.message)
      await load()
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!numeNou.trim() || adding) return
    setAdding(true)
    setError('')
    try {
      await addTipLucrare(numeNou.trim())
      setNumeNou('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteTipLucrare(id)
    await load()
  }

  return (
    <div className="card costuri-card">
      <div className="costuri-header">
        <h3>Tipuri de lucrare</h3>
        <p>
          Adaugă, redenumește sau șterge tipurile de lucrare disponibile în formularul de înregistrare, plus costul
          de laborator și suma facturată pentru fiecare — profitul se calculează automat. Modificările de cost/
          încasare se aplică doar lucrărilor înregistrate după salvare — cele existente păstrează valorile de la
          momentul înregistrării. Ștergerea unui tip nu afectează lucrările deja înregistrate cu acel tip — doar nu
          mai apare ca opțiune pentru unele noi.
        </p>
      </div>

      {loading ? (
        <p className="costuri-loading">Se încarcă…</p>
      ) : tipuri.length === 0 ? (
        <p className="costuri-empty">Niciun tip de lucrare definit încă.</p>
      ) : (
        <div className="costuri-table-wrap">
          <table className="costuri-table">
            <thead>
              <tr>
                <th>Tip lucrare</th>
                <th>Cost laborator</th>
                <th>Încasare</th>
                <th>Profit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tipuri.map((tip) => {
                const profit = (Number(tip.incasare) || 0) - (Number(tip.cost_laborator) || 0)
                return (
                  <tr key={tip.id}>
                    <td>
                      <input
                        type="text"
                        className="text-input costuri-input-nume"
                        value={tip.nume}
                        onChange={(e) => handleChange(tip.id, 'nume', e.target.value)}
                        onBlur={() => handleBlurNume(tip)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input costuri-input"
                        value={tip.cost_laborator}
                        onChange={(e) => handleChange(tip.id, 'cost_laborator', e.target.value)}
                        onBlur={() => handleBlurCosturi(tip)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input costuri-input"
                        value={tip.incasare}
                        onChange={(e) => handleChange(tip.id, 'incasare', e.target.value)}
                        onBlur={() => handleBlurCosturi(tip)}
                      />
                    </td>
                    <td>
                      <span className={`costuri-profit ${profit < 0 ? 'costuri-profit-negativ' : ''}`}>
                        {formatRON(profit)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost costuri-delete-btn"
                        onClick={() => handleDelete(tip.id)}
                        aria-label={`Șterge „${tip.nume}”`}
                      >
                        Șterge
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <form className="costuri-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          className="text-input"
          placeholder="Tip de lucrare nou…"
          value={numeNou}
          onChange={(e) => setNumeNou(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!numeNou.trim() || adding}>
          {adding ? 'Se adaugă…' : '+ Adaugă tip'}
        </button>
      </form>
      {error && <p className="costuri-error">{error}</p>}
    </div>
  )
}
