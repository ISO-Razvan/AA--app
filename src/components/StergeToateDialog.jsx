import { useEffect, useState } from 'react'
import { getLucrari, numaraLucrariSiDevize, stergeToateLucrarile } from '../services/dataService'
import { lucrariToCSV, downloadCSV } from '../utils/csv'
import { azi } from '../utils/date'
import './ConfirmDialog.css'
import './StergeToateDialog.css'

const CUVANT = 'STERGE'

// Al doilea pas al ștergerii totale: arată exact ce se șterge și câte rânduri,
// iar butonul final se activează doar după ce utilizatorul scrie STERGE.
// Înainte de ștergere descarcă un backup CSV al lucrărilor.
export default function StergeToateDialog({ onClose, onDone }) {
  const [numar, setNumar] = useState(null)
  const [text, setText] = useState('')
  const [ruleaza, setRuleaza] = useState(false)
  const [eroare, setEroare] = useState('')

  useEffect(() => {
    numaraLucrariSiDevize()
      .then(setNumar)
      .catch((err) => setEroare(err.message))
  }, [])

  const nimicDeSters = numar && numar.lucrari === 0 && numar.devize === 0
  const poateSterge = numar && !nimicDeSters && text === CUVANT && !ruleaza

  const inchide = () => {
    if (!ruleaza) onClose()
  }

  const handleSterge = async () => {
    if (!poateSterge) return
    setRuleaza(true)
    setEroare('')
    try {
      const lucrari = await getLucrari()
      downloadCSV(`lucrari-backup-${azi()}.csv`, lucrariToCSV(lucrari))
      const sterse = await stergeToateLucrarile()
      await onDone(sterse)
    } catch (err) {
      setEroare(err.message || 'A apărut o eroare la ștergere.')
      setRuleaza(false)
    }
  }

  return (
    <div className="confirm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) inchide() }}>
      <div className="confirm-dialog sterge-toate-dialog" role="alertdialog" aria-modal="true" aria-label="Ștergi toate lucrările?">
        <h3 className="confirm-dialog-title">Ștergi toate lucrările?</h3>

        {!numar && !eroare ? (
          <p className="confirm-dialog-message">Se numără lucrările și devizele…</p>
        ) : numar && nimicDeSters ? (
          <p className="confirm-dialog-message">Nu există lucrări sau devize de șters.</p>
        ) : numar ? (
          <>
            <p className="confirm-dialog-message">Se vor șterge definitiv:</p>
            <ul className="sterge-toate-lista">
              <li>
                toate lucrările — <strong>{numar.lucrari}</strong>
              </li>
              <li>etapele de producție bifate și planificate ale acestora</li>
              <li>pozele și link-urile din Galerie</li>
              <li>
                toate devizele generate — <strong>{numar.devize}</strong>
              </li>
            </ul>
            <p className="confirm-dialog-message">
              Istoricul de la Salarii pentru perioadele respective va dispărea. Configurarea din Setup (etape,
              tehnicieni, tipuri de lucrare, comisioane, extra-uri, clinici, medici, culori) și conturile de utilizator
              rămân neatinse. Înainte de ștergere se descarcă automat un backup CSV cu toate lucrările.
            </p>
            <p className="sterge-toate-avertisment">Acțiunea NU poate fi anulată.</p>

            <label className="field-label sterge-toate-label" htmlFor="sterge-toate-input">
              Scrie <strong>{CUVANT}</strong> ca să confirmi
            </label>
            <input
              id="sterge-toate-input"
              type="text"
              className="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={ruleaza}
              autoFocus
            />
          </>
        ) : null}

        {eroare && <p className="sterge-toate-eroare">{eroare}</p>}

        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={inchide} disabled={ruleaza}>
            Anulează
          </button>
          <button type="button" className="btn btn-danger" onClick={handleSterge} disabled={!poateSterge}>
            {ruleaza ? 'Se șterge…' : 'Șterge definitiv'}
          </button>
        </div>
      </div>
    </div>
  )
}
