import { useCallback, useEffect, useState } from 'react'
import {
  getNoteComanda,
  addNotaComanda,
  getSubiecteNote,
  noteDeschise,
  marcheazaNoteCitite,
  getMedici,
} from '../services/dataService'
import { subscribeToTable } from '../services/realtime'
import { notificaMedic } from '../services/notificari'
import { areAccesOperational } from '../utils/roluri'
import './NoteComanda.css'

const MAX_CARACTERE = 500

const ETICHETA_ROL = { patron: 'Patron', coordonator: 'Coordonator', tehnician: 'Tehnician', medic: 'Medic' }

// Bulina „notă nouă de la medic" de pe Listă / Kanban (nr = note necitite).
export function IndicatorNoteMedic({ nr }) {
  if (!nr) return null
  const eticheta = nr === 1 ? '1 notă nouă de la medic' : `${nr} note noi de la medic`
  return (
    <span className="indicator-note-medic" title={eticheta} aria-label={eticheta}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M2 3h12v8H6l-3 3v-3H2z" fill="currentColor" />
      </svg>
      {nr}
    </span>
  )
}

export function formatDataOraNota(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Tabul „Note" din fișa comenzii — note scurte cu subiect, fără editare sau
// ștergere. Implicit interne; „Trimite și medicului" e o alegere explicită.
// Patronul și coordonatorul marchează notele medicului ca citite la deschidere
// și pot anunța medicul pe WhatsApp (src/services/notificari.js).
export default function NoteComanda({ lucrare, profile, onCitite }) {
  const operational = areAccesOperational(profile)
  const [note, setNote] = useState(null)
  const [subiecte, setSubiecte] = useState([])
  const [deschise, setDeschise] = useState(true)
  const [medic, setMedic] = useState(null)
  const [subiectId, setSubiectId] = useState('')
  const [text, setText] = useState('')
  const [catreMedic, setCatreMedic] = useState(false)
  const [salvare, setSalvare] = useState(false)
  const [eroare, setEroare] = useState('')
  const [mesajWhatsApp, setMesajWhatsApp] = useState('')

  const reincarca = useCallback(async () => {
    const [n, d] = await Promise.all([getNoteComanda(lucrare.id), noteDeschise(lucrare.id)])
    setNote(n)
    setDeschise(d)
    if (operational && n.some((x) => x.rol_autor === 'medic' && !x.citita_de_lab)) {
      await marcheazaNoteCitite(lucrare.id)
      await onCitite?.()
    }
  }, [lucrare.id, operational, onCitite])

  useEffect(() => {
    async function load() {
      const [s, medici] = await Promise.all([getSubiecteNote(), getMedici()])
      const active = s.filter((x) => x.activ)
      setSubiecte(active)
      setSubiectId((prev) => prev || active[0]?.id || '')
      const cheie = (lucrare.medic || '').trim().toLowerCase()
      setMedic(medici.find((m) => m.nume.trim().toLowerCase() === cheie) || null)
    }
    load()
  }, [lucrare.medic])

  useEffect(() => {
    reincarca()
    return subscribeToTable('note_comanda', () => reincarca(), `comanda_id=eq.${lucrare.id}`)
  }, [lucrare.id, reincarca])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (salvare) return
    setEroare('')
    setSalvare(true)
    try {
      await addNotaComanda({
        comanda_id: lucrare.id,
        subiect_id: subiectId,
        text,
        vizibilitate: catreMedic ? 'medic' : 'intern',
      })
      setText('')
      setCatreMedic(false)
      await reincarca()
    } catch (err) {
      setEroare(err.message)
    } finally {
      setSalvare(false)
    }
  }

  const trimiteWhatsApp = (nota) => {
    const r = notificaMedic({ nota, comanda: lucrare, medic })
    setMesajWhatsApp(r.ok ? '' : r.motiv)
  }

  if (note === null) return <p className="note-gol">Se încarcă notele…</p>

  return (
    <div className="note-comanda">
      {note.length === 0 ? (
        <p className="note-gol">Nicio notă pe această comandă.</p>
      ) : (
        <ul className="note-lista">
          {note.map((n) => {
            const delaMedic = n.rol_autor === 'medic'
            const catreMedicul = n.vizibilitate === 'medic'
            return (
              <li key={n.id} className={`note-item ${delaMedic ? 'note-item-medic' : ''} ${catreMedicul && !delaMedic ? 'note-item-extern' : ''}`}>
                <div className="note-item-antet">
                  <span className="badge badge-blue">{n.subiect}</span>
                  <span className="note-item-autor">
                    {n.autor_nume}
                    <span className="note-item-rol"> · {ETICHETA_ROL[n.rol_autor] || n.rol_autor}</span>
                  </span>
                  <span className="note-item-data">{formatDataOraNota(n.created_at)}</span>
                </div>
                <p className="note-item-text">{n.text}</p>
                <div className="note-item-subsol">
                  {delaMedic ? (
                    <span className="badge badge-purple">De la medic</span>
                  ) : catreMedicul ? (
                    <span className="badge badge-warning">Trimisă medicului</span>
                  ) : (
                    <span className="badge badge-neutral">Internă</span>
                  )}
                  {catreMedicul && !delaMedic && (
                    <span className="note-item-citire">
                      {n.citita_de_medic ? `Văzută de medic · ${formatDataOraNota(n.citita_de_medic)}` : 'Nevăzută încă de medic'}
                    </span>
                  )}
                  {operational && catreMedicul && !delaMedic && (
                    <button
                      type="button"
                      className="btn btn-secondary note-whatsapp-btn"
                      onClick={() => trimiteWhatsApp(n)}
                      disabled={!medic?.telefon}
                      title={medic?.telefon ? `Deschide WhatsApp către ${medic.nume}` : 'Medicul nu are telefon (Setup → Medici)'}
                    >
                      Trimite pe WhatsApp
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {mesajWhatsApp && <p className="note-eroare">{mesajWhatsApp}</p>}

      {deschise ? (
        <form className="note-form" onSubmit={handleSubmit}>
          <div className="note-form-rand">
            <div>
              <label className="field-label" htmlFor="nota-subiect">Subiect</label>
              <select
                id="nota-subiect"
                className="text-input"
                value={subiectId}
                onChange={(e) => setSubiectId(e.target.value)}
                required
              >
                {subiecte.map((s) => (
                  <option key={s.id} value={s.id}>{s.nume}</option>
                ))}
              </select>
            </div>
            <label className="note-form-medic">
              <input type="checkbox" checked={catreMedic} onChange={(e) => setCatreMedic(e.target.checked)} />
              <span>Trimite și medicului</span>
            </label>
          </div>
          <div>
            <label className="field-label" htmlFor="nota-text">Notă</label>
            <textarea
              id="nota-text"
              className="text-input note-form-text"
              value={text}
              maxLength={MAX_CARACTERE}
              onChange={(e) => setText(e.target.value)}
              placeholder={catreMedic ? 'Mesajul pe care îl va vedea medicul…' : 'Notă internă, vizibilă doar în laborator…'}
              required
            />
            <p className="note-form-contor">{text.length} / {MAX_CARACTERE}</p>
          </div>
          {catreMedic && !medic && (
            <p className="note-form-hint">
              Medicul „{lucrare.medic || '—'}” nu e în lista din Setup → Medici, așa că nu va vedea nota în pagina lui.
            </p>
          )}
          {eroare && <p className="note-eroare">{eroare}</p>}
          <div className="note-form-actiuni">
            <button type="submit" className="btn btn-primary" disabled={salvare || !text.trim() || !subiectId}>
              {salvare ? 'Se salvează…' : catreMedic ? 'Adaugă și trimite medicului' : 'Adaugă nota'}
            </button>
          </div>
        </form>
      ) : (
        <p className="note-inchis">
          Comanda e închisă pentru note — a trecut perioada de după livrare (Setup → Note). Notele existente rămân de citit.
        </p>
      )}
    </div>
  )
}
