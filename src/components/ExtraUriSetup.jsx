import { useEffect, useState } from 'react'
import { getExtraUri, addExtra, updateExtra } from '../services/dataService'
import './TipuriLucrareCosturi.css'
import './ExtraUriSetup.css'

const MODURI = [
  { id: 'per_comanda', label: 'Per comandă' },
  { id: 'per_bucata', label: 'Per bucată' },
]

function ModTaxare({ value, onChange, disabled = false }) {
  return (
    <div className="extra-setup-mod" role="group" aria-label="Mod taxare">
      {MODURI.map((m) => (
        <button
          key={m.id}
          type="button"
          className={value === m.id ? 'active' : ''}
          onClick={() => value !== m.id && onChange(m.id)}
          disabled={disabled}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

const FORMULAR_GOL = { nume: '', pret: '', cost_laborator: '', mod_taxare: 'per_comanda' }

export default function ExtraUriSetup() {
  const [extra, setExtra] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nou, setNou] = useState(FORMULAR_GOL)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    setExtra(await getExtraUri())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (id, field, valoare) => {
    setExtra((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: valoare } : e)))
  }

  const salveaza = async (id, patch) => {
    setError('')
    try {
      await updateExtra(id, patch)
    } catch (err) {
      setError(err.message)
    }
    await load()
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!nou.nume.trim() || adding) return
    setAdding(true)
    setError('')
    try {
      await addExtra(nou)
      setNou(FORMULAR_GOL)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="card costuri-card">
      <div className="costuri-header">
        <h3>Extra-uri</h3>
        <p>
          Servicii taxabile suplimentar pe o comandă (ex. model printat, bont). Cele active apar ca etichete la
          înregistrare. Prețul și costul se copiază pe lucrare în momentul adăugării — modificările ulterioare se
          aplică doar extra-urilor adăugate după salvare. Un extra dezactivat nu mai apare la înregistrare, dar
          rămâne pe lucrările care îl au deja.
        </p>
      </div>

      {loading ? (
        <p className="costuri-loading">Se încarcă…</p>
      ) : (
        <div className="costuri-table-wrap">
          <table className="costuri-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Preț</th>
                <th>Cost laborator</th>
                <th>Mod taxare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {extra.map((ex) => {
                const sistem = !!ex.sistem
                return (
                  <tr key={ex.id} className={!ex.activ ? 'extra-setup-inactiv' : ''}>
                    <td>
                      {sistem ? (
                        <div className="extra-setup-nume-sistem">
                          <span>{ex.nume}</span>
                          <span className="extra-setup-badge">legat de bifa Try-in</span>
                        </div>
                      ) : (
                        <div className="extra-setup-nume">
                          <input
                            type="text"
                            className="text-input costuri-input-nume"
                            value={ex.nume}
                            onChange={(e) => handleChange(ex.id, 'nume', e.target.value)}
                            onBlur={() => salveaza(ex.id, { nume: ex.nume })}
                            aria-label="Nume extra"
                          />
                          {!ex.activ && <span className="extra-setup-badge extra-setup-badge-inactiv">Dezactivat</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input costuri-input"
                        value={ex.pret}
                        onChange={(e) => handleChange(ex.id, 'pret', e.target.value)}
                        onBlur={() => salveaza(ex.id, { pret: ex.pret })}
                        aria-label={`Preț — ${ex.nume}`}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input costuri-input"
                        value={ex.cost_laborator}
                        onChange={(e) => handleChange(ex.id, 'cost_laborator', e.target.value)}
                        onBlur={() => salveaza(ex.id, { cost_laborator: ex.cost_laborator })}
                        aria-label={`Cost laborator — ${ex.nume}`}
                      />
                    </td>
                    <td>
                      <ModTaxare
                        value={ex.mod_taxare}
                        onChange={(mod) => salveaza(ex.id, { mod_taxare: mod })}
                        disabled={sistem}
                      />
                    </td>
                    <td>
                      {!sistem && (
                        <button
                          type="button"
                          className="btn btn-ghost extra-setup-activ-btn"
                          onClick={() => salveaza(ex.id, { activ: !ex.activ })}
                        >
                          {ex.activ ? 'Dezactivează' : 'Activează'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <form className="extra-setup-add-form" onSubmit={handleAdd}>
        <input
          type="text"
          className="text-input"
          placeholder="Extra nou…"
          value={nou.nume}
          onChange={(e) => setNou((p) => ({ ...p, nume: e.target.value }))}
          aria-label="Nume extra nou"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          className="text-input costuri-input"
          placeholder="Preț"
          value={nou.pret}
          onChange={(e) => setNou((p) => ({ ...p, pret: e.target.value }))}
          aria-label="Preț extra nou"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          className="text-input costuri-input"
          placeholder="Cost lab."
          value={nou.cost_laborator}
          onChange={(e) => setNou((p) => ({ ...p, cost_laborator: e.target.value }))}
          aria-label="Cost laborator extra nou"
        />
        <ModTaxare value={nou.mod_taxare} onChange={(mod) => setNou((p) => ({ ...p, mod_taxare: mod }))} />
        <button type="submit" className="btn btn-primary" disabled={!nou.nume.trim() || adding}>
          {adding ? 'Se adaugă…' : '+ Adaugă extra'}
        </button>
      </form>
      {error && <p className="costuri-error">{error}</p>}
    </div>
  )
}
