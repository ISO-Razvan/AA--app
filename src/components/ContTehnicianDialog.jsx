import { useState } from 'react'
import { creeazaContTehnician } from '../services/dataService'
import './ConfirmDialog.css'
import './ContTehnicianDialog.css'

// Fără caractere ușor de confundat (0/O, 1/l/I), ca parola să poată fi
// dictată sau copiată de mână.
const ALFABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genereazaParola(lungime = 12) {
  const valori = crypto.getRandomValues(new Uint32Array(lungime))
  return Array.from(valori, (v) => ALFABET[v % ALFABET.length]).join('')
}

// Creează contul unui tehnician (sau îi resetează parola, dacă are deja
// cont) prin funcția de server, apoi arată O SINGURĂ DATĂ utilizatorul și
// parola temporară.
export default function ContTehnicianDialog({ tehnician, areCont, onClose, onDone }) {
  const [ruleaza, setRuleaza] = useState(false)
  const [eroare, setEroare] = useState('')
  const [rezultat, setRezultat] = useState(null)
  const [copiat, setCopiat] = useState(false)

  const handleConfirma = async () => {
    setRuleaza(true)
    setEroare('')
    const parola = genereazaParola()
    try {
      const r = await creeazaContTehnician(tehnician.id, parola)
      setRezultat({ ...r, parola })
      await onDone?.()
    } catch (err) {
      setEroare(err.message)
    } finally {
      setRuleaza(false)
    }
  }

  const copiaza = async () => {
    try {
      await navigator.clipboard.writeText(`Utilizator: ${rezultat.utilizator}\nParolă: ${rezultat.parola}`)
      setCopiat(true)
    } catch {
      setCopiat(false)
    }
  }

  const inchide = () => {
    if (!ruleaza) onClose()
  }

  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog cont-tehnician-dialog" role="alertdialog" aria-modal="true" aria-label={`Cont ${tehnician.nume}`}>
        {rezultat ? (
          <>
            <h3 className="confirm-dialog-title">{rezultat.creat ? 'Cont creat' : 'Parolă resetată'} — {tehnician.nume}</h3>
            <dl className="cont-tehnician-date">
              <dt>Utilizator</dt>
              <dd>{rezultat.utilizator}</dd>
              <dt>Parolă temporară</dt>
              <dd>{rezultat.parola}</dd>
            </dl>
            <p className="cont-tehnician-avertisment">
              Notează-le acum și transmite-le tehnicianului — parola nu mai poate fi afișată sau recuperată ulterior,
              doar resetată. După prima autentificare, tehnicianul își poate schimba parola din „Schimbă parola".
            </p>
            <p className="cont-tehnician-nota">La autentificare se poate folosi și adresa completă: {rezultat.email}</p>
            <div className="confirm-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={copiaza}>
                {copiat ? 'Copiat' : 'Copiază'}
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Am notat, închide
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="confirm-dialog-title">{areCont ? 'Resetezi parola?' : 'Creezi cont?'}</h3>
            <p className="confirm-dialog-message">
              {areCont
                ? `Se generează o parolă temporară nouă pentru ${tehnician.nume}. Parola actuală nu va mai funcționa.`
                : `Se creează un cont de autentificare pentru ${tehnician.nume}, cu o parolă temporară generată automat.`}
            </p>
            {eroare && <p className="cont-tehnician-eroare">{eroare}</p>}
            <div className="confirm-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={inchide} disabled={ruleaza}>
                Anulează
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirma} disabled={ruleaza}>
                {ruleaza ? 'Se procesează…' : areCont ? 'Resetează parola' : 'Creează cont'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
