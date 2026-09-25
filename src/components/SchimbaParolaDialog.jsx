import { useState } from 'react'
import { schimbaParola } from '../services/auth'
import './ConfirmDialog.css'
import './SchimbaParolaDialog.css'

const LUNGIME_MINIMA = 8

// Schimbarea parolei contului curent (admin sau tehnician) — de ex. parola
// temporară primită de un tehnician de la administrator.
export default function SchimbaParolaDialog({ onClose }) {
  const [parola, setParola] = useState('')
  const [confirmare, setConfirmare] = useState('')
  const [salvand, setSalvand] = useState(false)
  const [eroare, setEroare] = useState('')
  const [gata, setGata] = useState(false)

  const valida = parola.length >= LUNGIME_MINIMA && parola === confirmare

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valida || salvand) return
    setSalvand(true)
    setEroare('')
    try {
      await schimbaParola(parola)
      setGata(true)
    } catch (err) {
      setEroare(err.message || 'Parola nu s-a putut schimba.')
    } finally {
      setSalvand(false)
    }
  }

  return (
    <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvand) onClose() }}>
      <form className="confirm-dialog schimba-parola-dialog" onSubmit={handleSubmit} aria-label="Schimbă parola">
        <h3 className="confirm-dialog-title">Schimbă parola</h3>

        {gata ? (
          <p className="confirm-dialog-message">Parola a fost schimbată. Folosește-o de acum la autentificare.</p>
        ) : (
          <>
            <div className="schimba-parola-camp">
              <label className="field-label" htmlFor="parola-noua">Parola nouă</label>
              <input
                id="parola-noua"
                type="password"
                className="text-input"
                autoComplete="new-password"
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                autoFocus
              />
            </div>
            <div className="schimba-parola-camp">
              <label className="field-label" htmlFor="parola-confirmare">Confirmă parola nouă</label>
              <input
                id="parola-confirmare"
                type="password"
                className="text-input"
                autoComplete="new-password"
                value={confirmare}
                onChange={(e) => setConfirmare(e.target.value)}
              />
            </div>
            <p className="schimba-parola-hint">
              Minim {LUNGIME_MINIMA} caractere.
              {confirmare && parola !== confirmare && ' Parolele nu coincid.'}
            </p>
            {eroare && <p className="schimba-parola-eroare">{eroare}</p>}
          </>
        )}

        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={salvand}>
            {gata ? 'Închide' : 'Anulează'}
          </button>
          {!gata && (
            <button type="submit" className="btn btn-primary" disabled={!valida || salvand}>
              {salvand ? 'Se salvează…' : 'Schimbă parola'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
