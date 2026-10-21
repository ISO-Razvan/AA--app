import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { trimiteCodEmail, verificaCodEmail, signOut } from '../services/auth'
import {
  getInfoAccesMedic,
  getComenzileMeleMedic,
  getComandaMedic,
  getNoteleComenziiMedic,
  addNotaMedic,
  marcheazaNoteCitite,
  getSubiecteNote,
} from '../services/dataService'
import { esteMedic } from '../utils/roluri'
import { formatDataOraNota } from './NoteComanda.jsx'
import './MedicApp.css'

const MAX_CARACTERE = 500

function formatData(iso) {
  if (!iso) return '—'
  const [an, luna, zi] = iso.split('-')
  return `${zi}.${luna}.${an}`
}

const BADGE_STATUS = { Primită: 'badge-neutral', 'În lucru': 'badge-warning', Livrată: 'badge-success' }

// Baza de date cere un cod nou după 90 de zile (sesiune_medic_valida).
const sesiuneExpirata = (err) => /SESIUNE_EXPIRATA/.test(err?.message || '')

// Rutele medicului: /medic, /medic/acces/<cod>, /medic/comanda/<nr>.
function citesteRuta(pathname) {
  const parti = pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent)
  if (parti[0] === 'acces' && parti[1]) return { cod: parti[1] }
  if (parti[0] === 'comanda' && parti[1]) return { nr: parti[1] }
  return {}
}

function Cadru({ nume, onSignOut, children }) {
  return (
    <div className="medic-app">
      <header className="medic-antet">
        <div className="medic-brand">
          <img src="/logo.png" alt="" />
          <div>
            <strong>Algorithm Lab</strong>
            <span>Comenzile dumneavoastră</span>
          </div>
        </div>
        {onSignOut && (
          <div className="medic-cont">
            {nume && <span className="medic-cont-nume">{nume}</span>}
            <button type="button" className="btn btn-ghost medic-iesire" onClick={onSignOut}>
              Deconectare
            </button>
          </div>
        )}
      </header>
      <main className="medic-continut">{children}</main>
    </div>
  )
}

function Mesaj({ titlu, children }) {
  return (
    <div className="card medic-mesaj-card">
      {titlu && <h2>{titlu}</h2>}
      {children}
    </div>
  )
}

// Autentificare fără parolă: email → cod de 6 cifre pe email → sesiune.
function MedicLogin({ cod, motiv }) {
  const [info, setInfo] = useState(null)
  const [email, setEmail] = useState('')
  const [pas, setPas] = useState('email') // 'email' | 'cod'
  const [codEmail, setCodEmail] = useState('')
  const [ocupat, setOcupat] = useState(false)
  const [eroare, setEroare] = useState('')

  useEffect(() => {
    if (!cod) return
    getInfoAccesMedic(cod)
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [cod])

  const cereCod = async (e) => {
    e.preventDefault()
    setOcupat(true)
    setEroare('')
    try {
      await trimiteCodEmail(email)
      setPas('cod')
    } catch (err) {
      setEroare(
        /signups? not allowed|not found|otp_disabled/i.test(err.message)
          ? 'Adresa nu are acces. Verificați emailul sau contactați laboratorul.'
          : /rate|security purposes|too many/i.test(err.message)
            ? 'Ați cerut prea multe coduri. Încercați din nou peste un minut.'
            : `Codul nu s-a putut trimite: ${err.message}`
      )
    } finally {
      setOcupat(false)
    }
  }

  const verifica = async (e) => {
    e.preventDefault()
    setOcupat(true)
    setEroare('')
    try {
      await verificaCodEmail(email, codEmail)
      // Sesiunea nouă ajunge în App prin onAuthStateChange.
    } catch {
      setEroare('Cod greșit sau expirat. Verificați emailul sau cereți un cod nou.')
      setOcupat(false)
    }
  }

  return (
    <Cadru>
      <form className="card medic-login" onSubmit={pas === 'email' ? cereCod : verifica}>
        <h2>{info?.medic ? `Bun venit, ${info.medic}` : 'Autentificare'}</h2>
        {motiv && <p className="medic-login-motiv">{motiv}</p>}
        {pas === 'email' ? (
          <>
            <p className="medic-login-hint">
              Introduceți adresa de email
              {info?.email_mascat ? ` (${info.email_mascat})` : ''}. Veți primi un cod de autentificare.
            </p>
            <div>
              <label className="field-label" htmlFor="medic-email">Email</label>
              <input
                id="medic-email"
                type="email"
                className="text-input"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <>
            <p className="medic-login-hint">Am trimis un cod pe {email}. Introduceți-l mai jos.</p>
            <div>
              <label className="field-label" htmlFor="medic-cod">Cod din email</label>
              <input
                id="medic-cod"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="text-input medic-cod-input"
                value={codEmail}
                onChange={(e) => setCodEmail(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
              />
            </div>
          </>
        )}
        {eroare && <p className="medic-eroare">{eroare}</p>}
        <button type="submit" className="btn btn-primary" disabled={ocupat}>
          {ocupat ? 'Se procesează…' : pas === 'email' ? 'Trimite-mi codul' : 'Intră'}
        </button>
        {pas === 'cod' && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setPas('email')
              setCodEmail('')
              setEroare('')
            }}
          >
            Alt email / cod nou
          </button>
        )}
      </form>
    </Cadru>
  )
}

function ListaComenzi({ onDeschide, onExpirat }) {
  const [comenzi, setComenzi] = useState(null)
  const [eroare, setEroare] = useState('')

  const load = useCallback(async () => {
    try {
      setComenzi(await getComenzileMeleMedic())
    } catch (err) {
      if (sesiuneExpirata(err)) onExpirat()
      else setEroare(err.message)
    }
  }, [onExpirat])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  if (eroare) return <Mesaj titlu="Nu s-au putut încărca comenzile"><p>{eroare}</p></Mesaj>
  if (comenzi === null) return <p className="medic-gol">Se încarcă…</p>
  return (
    <section>
      <h1 className="medic-titlu">Comenzi active</h1>
      {comenzi.length === 0 ? (
        <p className="medic-gol">Nu aveți comenzi active în acest moment.</p>
      ) : (
        <ul className="medic-comenzi">
          {comenzi.map((c) => (
            <li key={c.id}>
              <button type="button" className="card medic-comanda-card" onClick={() => onDeschide(c.nr_inregistrare)}>
                <span className="medic-comanda-pacient">
                  {c.pacient || '—'}
                  {c.note_necitite > 0 && (
                    <span className="medic-note-noi">{c.note_necitite === 1 ? '1 notă nouă' : `${c.note_necitite} note noi`}</span>
                  )}
                </span>
                <span className="medic-comanda-detalii">
                  <span>{c.nr_inregistrare}</span>
                  <span>Intrare: {formatData(c.data_intrare)}</span>
                  <span>Termen: {formatData(c.termen_predare)}</span>
                </span>
                <span className={`badge ${BADGE_STATUS[c.status] || 'badge-neutral'}`}>{c.status}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ComandaMedic({ nr, onInapoi, onExpirat }) {
  const [comanda, setComanda] = useState(undefined)
  const [note, setNote] = useState([])
  const [subiecte, setSubiecte] = useState([])
  const [subiectId, setSubiectId] = useState('')
  const [text, setText] = useState('')
  const [trimitere, setTrimitere] = useState(false)
  const [eroare, setEroare] = useState('')

  const load = useCallback(async () => {
    try {
      const c = await getComandaMedic(nr)
      setComanda(c)
      if (!c) return
      setNote(await getNoteleComenziiMedic(c.id))
      await marcheazaNoteCitite(c.id)
    } catch (err) {
      if (sesiuneExpirata(err)) onExpirat()
      else setEroare(err.message)
    }
  }, [nr, onExpirat])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  useEffect(() => {
    getSubiecteNote()
      .then((s) => {
        const active = s.filter((x) => x.activ)
        setSubiecte(active)
        setSubiectId(active.find((x) => x.nume === 'Informație')?.id || active[0]?.id || '')
      })
      .catch(() => setSubiecte([]))
  }, [])

  const trimite = async (e) => {
    e.preventDefault()
    setTrimitere(true)
    setEroare('')
    try {
      await addNotaMedic(comanda.id, subiectId, text)
      setText('')
      await load()
    } catch (err) {
      if (sesiuneExpirata(err)) onExpirat()
      else setEroare(err.message)
    } finally {
      setTrimitere(false)
    }
  }

  if (comanda === undefined && !eroare) return <p className="medic-gol">Se încarcă…</p>
  if (!comanda) {
    return (
      <Mesaj titlu="Comanda nu a fost găsită">
        <p>{eroare || 'Comanda nu există sau nu vă aparține.'}</p>
        <button type="button" className="btn btn-secondary" onClick={onInapoi}>Înapoi la comenzi</button>
      </Mesaj>
    )
  }

  const deschisa = comanda.deschisa

  return (
    <section className="medic-comanda">
      <button type="button" className="btn btn-ghost medic-inapoi" onClick={onInapoi}>‹ Toate comenzile</button>
      <div className="card medic-comanda-antet">
        <h1 className="medic-titlu">{comanda.pacient || '—'}</h1>
        <p>
          {comanda.nr_inregistrare} · Intrare: {formatData(comanda.data_intrare)} · Termen: {formatData(comanda.termen_predare)}
        </p>
      </div>

      <h2 className="medic-subtitlu">Note</h2>
      {note.length === 0 ? (
        <p className="medic-gol">Nicio notă încă pe această comandă.</p>
      ) : (
        <ul className="medic-note">
          {note.map((n) => (
            <li key={n.id} className={`medic-nota ${n.de_la === 'medic' ? 'medic-nota-proprie' : ''}`}>
              <div className="medic-nota-antet">
                <span className="badge badge-blue">{n.subiect}</span>
                <strong>{n.de_la === 'medic' ? 'Dumneavoastră' : 'Algorithm Lab'}</strong>
                <span className="medic-nota-data">{formatDataOraNota(n.created_at)}</span>
              </div>
              <p className="medic-nota-text">{n.text}</p>
            </li>
          ))}
        </ul>
      )}

      {deschisa ? (
        <form className="card medic-raspuns" onSubmit={trimite}>
          <h3>Răspuns către laborator</h3>
          <div>
            <label className="field-label" htmlFor="medic-subiect">Subiect</label>
            <select id="medic-subiect" className="text-input" value={subiectId} onChange={(e) => setSubiectId(e.target.value)} required>
              {subiecte.map((s) => (
                <option key={s.id} value={s.id}>{s.nume}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="medic-text">Mesaj</label>
            <textarea
              id="medic-text"
              className="text-input medic-raspuns-text"
              value={text}
              maxLength={MAX_CARACTERE}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <p className="medic-contor">{text.length} / {MAX_CARACTERE}</p>
          </div>
          {eroare && <p className="medic-eroare">{eroare}</p>}
          <button type="submit" className="btn btn-primary" disabled={trimitere || !text.trim() || !subiectId}>
            {trimitere ? 'Se trimite…' : 'Trimite'}
          </button>
        </form>
      ) : (
        <p className="medic-inchis">Comanda a fost livrată și nu mai primește note noi.</p>
      )}
    </section>
  )
}

// Pagina medicului — separată de interfața laboratorului (fără sidebar).
// Datele vin doar prin funcțiile din baza de date care verifică medicul logat.
export default function MedicApp({ session, profile, profileLoading }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { cod, nr } = citesteRuta(location.pathname)
  const [motivLogin, setMotivLogin] = useState('')

  const iesire = useCallback(async () => {
    await signOut()
    navigate('/medic', { replace: true })
  }, [navigate])

  const expirat = useCallback(async () => {
    setMotivLogin('Sesiunea a expirat. Cereți un cod nou pe email.')
    await signOut()
  }, [])

  // Medic logat ajuns pe linkul de acces → direct la comenzi.
  useEffect(() => {
    if (cod && session && esteMedic(profile)) navigate('/medic', { replace: true })
  }, [cod, session, profile, navigate])

  if (session === undefined || (session && profileLoading && !profile)) {
    return <Cadru><p className="medic-gol">Se încarcă…</p></Cadru>
  }
  if (!session) return <MedicLogin cod={cod} motiv={motivLogin} />

  if (!esteMedic(profile)) {
    return (
      <Cadru onSignOut={iesire}>
        <Mesaj titlu="Cont de laborator">
          <p>Sunteți autentificat cu un cont care nu este de medic.</p>
          <div className="medic-mesaj-actiuni">
            <a className="btn btn-secondary" href="/">Deschide aplicația laboratorului</a>
          </div>
        </Mesaj>
      </Cadru>
    )
  }

  if (!profile.activ) {
    return (
      <Cadru onSignOut={iesire}>
        <Mesaj titlu="Acces dezactivat">
          <p>Accesul dumneavoastră a fost dezactivat. Pentru detalii, contactați laboratorul.</p>
        </Mesaj>
      </Cadru>
    )
  }

  return (
    <Cadru nume={profile.nume} onSignOut={iesire}>
      {nr ? (
        <ComandaMedic nr={nr} onInapoi={() => navigate('/medic')} onExpirat={expirat} />
      ) : (
        <ListaComenzi onDeschide={(n) => navigate(`/medic/comanda/${encodeURIComponent(n)}`)} onExpirat={expirat} />
      )}
    </Cadru>
  )
}
