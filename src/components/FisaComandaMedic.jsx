import { useCallback, useEffect, useState } from 'react'
import {
  getFisaComandaMedic,
  getGalerieComandaMedic,
  getNoteleComenziiMedic,
  addNotaMedic,
  marcheazaNoteCitite,
  getSubiecteNote,
} from '../services/dataService'
import { MODEL_OPTIONS } from '../data/configDefaults'
import { dinDintiSalvati } from '../utils/dintiGrupuri'
import { grupeazaDiscutii } from '../utils/discutiiNote'
import DentalChart from './DentalChart.jsx'
import GaleriePoze from './GaleriePoze.jsx'
import { ExtraUriLista } from './ExtraUriPicker.jsx'
import { DiscutieNote, MAX_CARACTERE_NOTA } from './NoteComanda.jsx'
import './LucrareDetailPanel.css'
import './NoteComanda.css'

const TABS = [
  { id: 'detalii', label: 'Detalii comandă' },
  { id: 'galerie', label: 'Galerie' },
  { id: 'note', label: 'Note' },
]

const BADGE_STATUS = { Primită: 'badge-neutral', 'În lucru': 'badge-warning', Livrată: 'badge-success' }

function formatData(iso) {
  if (!iso) return '—'
  const [an, luna, zi] = iso.split('-')
  return `${zi}.${luna}.${an}`
}

function Valoare({ eticheta, children }) {
  return (
    <div>
      <span className="field-label">{eticheta}</span>
      <div className="culoare-readonly">{children || <span className="culoare-readonly-empty">—</span>}</div>
    </div>
  )
}

// Tabul Detalii — aceleași câmpuri și aceeași schemă dentară ca în fișa din
// laborator, doar de citit. Fără prețuri, producție și nota internă.
function DetaliiMedic({ fisa }) {
  const dinti = dinDintiSalvati(fisa.dinti)
  return (
    <div className="detail-tab-detalii">
      <div className="detail-chart-col">
        <DentalChart
          selectateNumere={dinti.selectateNumere}
          linkPairs={dinti.linkPairs}
          implantNumere={dinti.implantNumere}
          onToggleTooth={() => {}}
          onToggleLink={() => {}}
          onToggleImplant={() => {}}
          culoare={fisa.culoare}
          culoriOptions={[]}
          onCuloareChange={() => {}}
          readOnly
        />
      </div>
      <div className="detail-sections-col">
        <section className="detail-section">
          <h3 className="detail-section-title">Client</h3>
          <div className="detail-section-grid">
            <Valoare eticheta="Clinică">{fisa.clinica}</Valoare>
            <Valoare eticheta="Medic">{fisa.medic}</Valoare>
            <Valoare eticheta="Pacient">{fisa.pacient}</Valoare>
          </div>
        </section>
        <section className="detail-section">
          <h3 className="detail-section-title">Lucrare</h3>
          <Valoare eticheta="Tip lucrare">{fisa.tip_lucrare}</Valoare>
          <div className="detail-field-row">
            <Valoare eticheta="Culoare (VITA)">{fisa.culoare}</Valoare>
            <Valoare eticheta="Nr. elemente">{String(fisa.nr_elemente ?? 0)}</Valoare>
          </div>
          <div className="detail-field-row-3">
            <Valoare eticheta="Implant">{fisa.implant ? 'Da' : 'Nu'}</Valoare>
            <Valoare eticheta="Try-in">{fisa.try_in ? 'Da' : 'Nu'}</Valoare>
            <Valoare eticheta="Model">{MODEL_OPTIONS.includes(fisa.model) ? fisa.model : ''}</Valoare>
          </div>
          <div>
            <span className="field-label">Extra-uri</span>
            <ExtraUriLista selectie={fisa.extra_uri || []} />
          </div>
        </section>
        <section className="detail-section">
          <h3 className="detail-section-title">Termene</h3>
          <div className="detail-field-row-3">
            <Valoare eticheta="Data intrare">{formatData(fisa.data_intrare)}</Valoare>
            <Valoare eticheta="Termen predare">{formatData(fisa.termen_predare)}</Valoare>
            <Valoare eticheta="Ora programare">{fisa.ora_programare ? fisa.ora_programare.slice(0, 5) : ''}</Valoare>
          </div>
          <Valoare eticheta="Next date">{fisa.next_date ? formatData(fisa.next_date) : ''}</Valoare>
        </section>
      </div>
    </div>
  )
}

// Notele comenzii pentru medic — discuții, cu răspuns pe aceeași notă și
// posibilitatea de a începe o discuție nouă.
function NoteMedic({ fisa, onExpirat, esteExpirata }) {
  const [note, setNote] = useState(null)
  const [deschisa, setDeschisa] = useState(fisa.deschisa)
  const [subiecte, setSubiecte] = useState([])
  const [subiectId, setSubiectId] = useState('')
  const [text, setText] = useState('')
  const [trimitere, setTrimitere] = useState(false)
  const [eroare, setEroare] = useState('')

  const trateaza = useCallback(
    (err) => {
      if (esteExpirata(err)) onExpirat()
      else throw err
    },
    [esteExpirata, onExpirat]
  )

  const load = useCallback(async () => {
    try {
      const n = await getNoteleComenziiMedic(fisa.id)
      setNote(n)
      if (n.length > 0) setDeschisa(n[0].deschisa)
      await marcheazaNoteCitite(fisa.id)
    } catch (err) {
      try {
        trateaza(err)
      } catch (e) {
        setEroare(e.message)
      }
    }
  }, [fisa.id, trateaza])

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

  const notaNoua = async (e) => {
    e.preventDefault()
    setTrimitere(true)
    setEroare('')
    try {
      await addNotaMedic(fisa.id, subiectId, text)
      setText('')
      await load()
    } catch (err) {
      try {
        trateaza(err)
      } catch (e2) {
        setEroare(e2.message)
      }
    } finally {
      setTrimitere(false)
    }
  }

  const raspunde = async (nota, t) => {
    try {
      await addNotaMedic(fisa.id, null, t, nota.id)
    } catch (err) {
      trateaza(err)
    }
    await load()
  }

  if (note === null) return <p className="medic-gol">{eroare || 'Se încarcă…'}</p>

  const discutii = grupeazaDiscutii(note, (n) => !!n.rezolvata)

  return (
    <div className="note-comanda">
      {discutii.length === 0 ? (
        <p className="note-gol">Nicio notă încă pe această comandă.</p>
      ) : (
        <ul className="note-lista">
          {discutii.map((d) => (
            <DiscutieNote
              key={d.nota.id}
              discutie={d}
              autor={(n) => (n.de_la === 'medic' ? { nume: 'Dumneavoastră', deLaMedic: true } : { nume: 'Algorithm Lab' })}
              poateRaspunde={deschisa}
              onRaspunde={(t) => raspunde(d.nota, t)}
            />
          ))}
        </ul>
      )}

      {deschisa ? (
        <form className="note-form" onSubmit={notaNoua}>
          <h4 className="note-form-titlu">Mesaj nou către laborator</h4>
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
              className="text-input note-form-text"
              value={text}
              maxLength={MAX_CARACTERE_NOTA}
              onChange={(e) => setText(e.target.value)}
              required
            />
            <p className="note-form-contor">{text.length} / {MAX_CARACTERE_NOTA}</p>
          </div>
          {eroare && <p className="note-eroare">{eroare}</p>}
          <div className="note-form-actiuni">
            <button type="submit" className="btn btn-primary" disabled={trimitere || !text.trim() || !subiectId}>
              {trimitere ? 'Se trimite…' : 'Trimite'}
            </button>
          </div>
        </form>
      ) : (
        <p className="note-inchis">Comanda a fost livrată și nu mai primește note noi.</p>
      )}
    </div>
  )
}

// Fișa comenzii văzută de medic: Detalii comandă, Galerie, Note — totul doar
// prin funcțiile din baza de date care verifică medicul logat.
// `tabInitial` = 'note' când medicul vine din linkul de pe WhatsApp.
export default function FisaComandaMedic({ nr, tabInitial, onInapoi, onExpirat, esteExpirata }) {
  const [fisa, setFisa] = useState(undefined)
  const [eroare, setEroare] = useState('')
  const [tab, setTab] = useState(TABS.some((t) => t.id === tabInitial) ? tabInitial : 'detalii')

  useEffect(() => {
    let activ = true
    getFisaComandaMedic(nr)
      .then((f) => {
        if (activ) setFisa(f)
      })
      .catch((err) => {
        if (!activ) return
        if (esteExpirata(err)) onExpirat()
        else {
          setEroare(err.message)
          setFisa(null)
        }
      })
    return () => {
      activ = false
    }
  }, [nr, onExpirat, esteExpirata])

  if (fisa === undefined) return <p className="medic-gol">Se încarcă…</p>
  if (!fisa) {
    return (
      <div className="card medic-mesaj-card">
        <h2>Comanda nu a fost găsită</h2>
        <p>{eroare || 'Comanda nu există sau nu vă aparține.'}</p>
        <button type="button" className="btn btn-secondary" onClick={onInapoi}>Înapoi la comenzi</button>
      </div>
    )
  }

  return (
    <section className="medic-fisa">
      <button type="button" className="btn btn-ghost medic-inapoi" onClick={onInapoi}>‹ Toate comenzile</button>
      <div className="detail-panel medic-fisa-panou">
        <header className="detail-panel-header">
          <div className="detail-panel-title">
            <div className="detail-panel-title-row">
              <h2>{fisa.pacient || 'Pacient necompletat'}</h2>
              <span className={`badge ${BADGE_STATUS[fisa.status] || 'badge-neutral'}`}>{fisa.status}</span>
            </div>
            <p className="detail-panel-subtitlu">
              <span className="rezumat-medic">{fisa.medic || '—'}</span>
              <span className="detail-panel-subtitlu-sep" aria-hidden="true">·</span>
              <span className="rezumat-tip">{fisa.tip_lucrare || '—'}</span>
            </p>
            <p>{fisa.nr_inregistrare}</p>
          </div>
        </header>
        <nav className="detail-panel-tabs" aria-label="Secțiuni comandă">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`detail-panel-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="detail-panel-body">
          {tab === 'detalii' && <DetaliiMedic fisa={fisa} />}
          {tab === 'galerie' && (
            <GaleriePoze lucrareId={fisa.id} readOnly mesajReadOnly={null} incarca={() => getGalerieComandaMedic(fisa.id)} />
          )}
          {tab === 'note' && <NoteMedic fisa={fisa} onExpirat={onExpirat} esteExpirata={esteExpirata} />}
        </div>
      </div>
    </section>
  )
}
