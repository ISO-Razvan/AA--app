import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getObiective,
  updateObiectiv,
  creeazaObiectiv,
  deleteObiectiv,
  getObiectiveSaptamana,
  getObiectiveEvolutie,
  getActiuniObiective,
  addActiuneObiectiv,
  updateActiuneObiectiv,
  deleteActiuneObiectiv,
  getRevizuiriObiective,
  confirmaRevizuireObiective,
} from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { useConfirm } from '../hooks/useConfirm.jsx'
import { TitluCuAjutor } from '../ajutor/Ajutor.jsx'
import DatePicker from './DatePicker.jsx'
import './ObiectivePage.css'

// Obiectivele companiei (ISO 9001 6.2 / 9.1) — doar patronul. Valorile se
// calculează în baza de date (obiective_saptamana); o săptămână revizuită
// arată valorile înghețate la confirmare.

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']
const LUNI_LUNG = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie']

const STARI = {
  pe_drum: { label: 'Pe drum', cls: 'ob-stare-ok' },
  la_risc: { label: 'La risc', cls: 'ob-stare-risc' },
  sub_tinta: { label: 'Sub țintă', cls: 'ob-stare-rau' },
  fara_tinta: { label: 'Țintă nesetată', cls: 'ob-stare-neutru' },
  fara_date: { label: 'Fără date', cls: 'ob-stare-neutru' },
}

const CATEGORII = { Livrare: 'ob-tag-teal', Calitate: 'ob-tag-mov', Financiar: 'ob-tag-navy' }

// Cele 3 metrici calculate automat. Categoria, unitatea și sensul le stabilește
// baza de date din metrică (creeaza_obiectiv); aici sunt doar pentru formular.
const METRICI = [
  {
    id: 'livrari_la_termen',
    titlu: 'Livrări la termen',
    tinta: 'Țintă (minim, %)',
    explicatie: 'Procentul lucrărilor finalizate în laborator în săptămână până la termenul de predare. Mai mare e mai bine.',
    evaluare: 'Săptămânal: lucrările finalizate în laborator până la termenul de predare, din cele finalizate în săptămână',
  },
  {
    id: 'refaceri',
    titlu: 'Refaceri și neconformități',
    tinta: 'Țintă (maxim, %)',
    explicatie: 'Refacerile create în săptămână, raportate la lucrările finalizate în aceeași săptămână. Mai mic e mai bine.',
    evaluare: 'Săptămânal: refacerile înregistrate, raportate la lucrările finalizate în aceeași săptămână',
  },
  {
    id: 'valoare_intrata',
    titlu: 'Valoare comenzi intrate',
    tinta: 'Țintă (RON pe lună)',
    explicatie: 'Valoarea comenzilor după data intrării, cumulată pe luna în care cade joia săptămânii. Mai mare e mai bine.',
    evaluare: 'Săptămânal: valoarea cumulată a lunii (după data intrării) față de ținta lunară',
  },
]

// Obiectiv nou: metrica, ținta, responsabilul, termenul și planul (resurse,
// evaluare, prima acțiune) — obligatoriu înainte de salvare.
function FormObiectivNou({ onCreat, onAnuleaza }) {
  const [f, setF] = useState({
    indicator: METRICI[0].id,
    titlu: METRICI[0].titlu,
    tinta: '',
    responsabil: '',
    termen: '',
    resurse: '',
    evaluare: METRICI[0].evaluare,
    actiune: '',
    actiuneResponsabil: '',
    actiuneTermen: '',
  })
  const [salvare, setSalvare] = useState(false)
  const [eroare, setEroare] = useState('')
  const metrica = METRICI.find((m) => m.id === f.indicator)
  const seteaza = (camp) => (e) => setF((x) => ({ ...x, [camp]: e?.target ? e.target.value : e }))

  // La schimbarea metricii, titlul și evaluarea implicite o urmează (dacă nu
  // au fost modificate de mână).
  const alegeMetrica = (e) => {
    const noua = METRICI.find((m) => m.id === e.target.value)
    setF((x) => ({
      ...x,
      indicator: noua.id,
      titlu: METRICI.some((m) => m.titlu === x.titlu) || !x.titlu ? noua.titlu : x.titlu,
      evaluare: METRICI.some((m) => m.evaluare === x.evaluare) || !x.evaluare ? noua.evaluare : x.evaluare,
    }))
  }

  const complet = f.titlu.trim() && f.tinta !== '' && f.resurse.trim() && f.evaluare.trim() && f.actiune.trim()

  const trimite = async (e) => {
    e.preventDefault()
    setSalvare(true)
    setEroare('')
    try {
      await creeazaObiectiv(f)
      await onCreat()
    } catch (err) {
      setEroare(err.message)
      setSalvare(false)
    }
  }

  return (
    <form className="card ob-nou" onSubmit={trimite}>
      <h2 className="ob-card-titlu">Obiectiv nou</h2>
      <div className="ob-form-rand">
        <div>
          <label className="field-label" htmlFor="obn-metrica">Metrica</label>
          <select id="obn-metrica" className="text-input" value={f.indicator} onChange={alegeMetrica}>
            {METRICI.map((m) => (
              <option key={m.id} value={m.id}>{m.titlu}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="obn-tinta">{metrica.tinta} *</label>
          <input id="obn-tinta" type="number" min="0" step="any" className="text-input" value={f.tinta} onChange={seteaza('tinta')} required />
        </div>
      </div>
      <p className="ob-detaliu">{metrica.explicatie}</p>
      <div>
        <label className="field-label" htmlFor="obn-titlu">Titlu *</label>
        <input id="obn-titlu" className="text-input" value={f.titlu} onChange={seteaza('titlu')} required />
      </div>
      <div className="ob-form-rand">
        <div>
          <label className="field-label" htmlFor="obn-resp">Responsabil</label>
          <input id="obn-resp" className="text-input" value={f.responsabil} onChange={seteaza('responsabil')} />
        </div>
        <div>
          <span className="field-label">Termen</span>
          <DatePicker value={f.termen} onChange={seteaza('termen')} />
        </div>
      </div>

      <h3 className="ob-nou-sectiune">Plan (obligatoriu)</h3>
      <div>
        <label className="field-label" htmlFor="obn-resurse">Resurse *</label>
        <input id="obn-resurse" className="text-input" value={f.resurse} onChange={seteaza('resurse')} placeholder="ex. 30 min pe zi pentru planificare" required />
      </div>
      <div>
        <label className="field-label" htmlFor="obn-eval">Metoda de evaluare *</label>
        <textarea id="obn-eval" className="text-input ob-textarea-mic" value={f.evaluare} onChange={seteaza('evaluare')} required />
      </div>
      <div>
        <label className="field-label" htmlFor="obn-act">Prima acțiune *</label>
        <textarea id="obn-act" className="text-input ob-textarea-mic" value={f.actiune} maxLength={500} onChange={seteaza('actiune')} required />
      </div>
      <div className="ob-form-rand">
        <div>
          <label className="field-label" htmlFor="obn-act-resp">Responsabil acțiune</label>
          <input id="obn-act-resp" className="text-input" value={f.actiuneResponsabil} onChange={seteaza('actiuneResponsabil')} />
        </div>
        <div>
          <span className="field-label">Termen acțiune (gol = continuu)</span>
          <DatePicker value={f.actiuneTermen} onChange={seteaza('actiuneTermen')} />
        </div>
      </div>
      {eroare && <p className="ob-eroare">{eroare}</p>}
      <div className="ob-form-actiuni">
        <button type="button" className="btn btn-ghost" onClick={onAnuleaza}>Anulează</button>
        <button type="submit" className="btn btn-primary" disabled={salvare || !complet}>
          {salvare ? 'Se salvează…' : 'Creează și activează'}
        </button>
      </div>
    </form>
  )
}

const STATUS_ACTIUNI = [
  { id: 'de_facut', label: 'De făcut' },
  { id: 'in_curs', label: 'În curs' },
  { id: 'realizat', label: 'Realizat' },
]
const STATUS_ACTIUNE = Object.fromEntries(STATUS_ACTIUNI.map((s) => [s.id, s]))

// Lunea săptămânii unei date 'AAAA-LL-ZZ'.
function luniaSaptamanii(iso) {
  const [a, l, z] = iso.split('-').map(Number)
  const zi = new Date(a, l - 1, z).getDay() // 0 = duminică
  return adaugaZile(iso, zi === 0 ? -6 : 1 - zi)
}

function dataScurta(iso, cuAn = false) {
  const [a, l, z] = iso.split('-').map(Number)
  return `${z} ${LUNI_SCURT[l - 1]}${cuAn ? ` ${a}` : ''}`
}

function eticheteSaptamana(luni, cuAn = false) {
  const duminica = adaugaZile(luni, 6)
  const [, l1] = luni.split('-').map(Number)
  const [, l2] = duminica.split('-').map(Number)
  const inceput = l1 === l2 ? String(Number(luni.slice(8))) : dataScurta(luni)
  return `${inceput} – ${dataScurta(duminica, cuAn)}`
}

function dataOra(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()} ${LUNI_SCURT[d.getMonth()]} ${d.getFullYear()}`
}

const nr = (v, zecimale = 0) =>
  v == null ? '—' : Number(v).toLocaleString('ro-RO', { minimumFractionDigits: zecimale, maximumFractionDigits: zecimale })

const formatValoare = (o) => (o.valoare == null ? '—' : o.unitate === 'RON' ? nr(o.valoare) : nr(o.valoare, Number(o.valoare) % 1 ? 1 : 0))

function textTinta(o, def) {
  if (o.tinta == null) return 'țintă nesetată'
  if (o.unitate === 'RON') return `țintă ${nr(o.tinta)} RON / lună`
  return `țintă ${def?.sens === 'max' || o.sens === 'max' ? '≤' : '≥'} ${nr(o.tinta, o.tinta % 1 ? 1 : 0)}%`
}

function detaliuValoare(o, luna, panaLa) {
  const d = o.detalii || {}
  if (o.indicator === 'livrari_la_termen') {
    if (!d.finalizate_cu_termen) return 'Nicio lucrare finalizată în săptămână (cu termen de predare).'
    const baza = `${d.la_termen} din ${d.finalizate_cu_termen} lucrări finalizate până la termenul de predare`
    return d.fara_termen ? `${baza} · ${d.fara_termen} fără termen, neincluse` : baza
  }
  if (o.indicator === 'refaceri') {
    const r = d.refaceri ?? 0
    if (!d.finalizate) return `${r === 1 ? '1 refacere' : `${r} refaceri`}; nicio lucrare finalizată în săptămână.`
    return `${r === 1 ? '1 refacere' : `${r} refaceri`} din ${d.finalizate} lucrări finalizate`
  }
  const l = d.luna || luna
  const p = d.pana_la || panaLa
  if (!l) return ''
  const [a, m] = l.split('-').map(Number)
  const ultima = new Date(a, m, 0).getDate()
  const zi = p ? Number(p.slice(8)) : ultima
  const perioada = zi < ultima ? ` (1–${zi} ${LUNI_SCURT[m - 1]})` : ''
  const comenzi = d.comenzi != null ? ` · ${d.comenzi} comenzi` : ''
  return `${LUNI_LUNG[m - 1]} ${a}${perioada}, după data intrării${comenzi}`
}

// Scala barei: % „≥” până la 100; % „≤” până la dublul țintei; RON — ținta la 75%.
function scala(o) {
  if (o.unitate === 'RON') {
    const t = Number(o.tinta_efectiva ?? o.tinta)
    return t > 0 ? t / 0.75 : Math.max(Number(o.valoare) || 0, 1) * 1.25
  }
  if (o.sens === 'max') return Math.max(Number(o.tinta ?? 0) * 2, Number(o.valoare ?? 0) * 1.2, 1)
  return 100
}

function Grafic({ valori, tinta, eticheta }) {
  const W = 132
  const H = 40
  const PAD = 4
  const puncte = valori.map((v, i) => ({ i, v })).filter((p) => p.v != null)
  if (puncte.length < 2) {
    return (
      <div className="ob-grafic-gol" role="img" aria-label="Date insuficiente pentru tendință">
        Date insuficiente
      </div>
    )
  }
  const toate = puncte.map((p) => Number(p.v)).concat(tinta != null ? [Number(tinta)] : [])
  const min = Math.min(...toate)
  const max = Math.max(...toate)
  const interval = max - min || 1
  const y = (v) => (H - PAD - ((v - min) / interval) * (H - 2 * PAD)).toFixed(1)
  const x = (i) => (PAD + i * ((W - 2 * PAD) / (valori.length - 1))).toFixed(1)
  const ultim = puncte[puncte.length - 1]
  return (
    <svg className="ob-grafic" role="img" aria-label={eticheta} width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      {tinta != null && (
        <line x1={PAD} x2={W - PAD} y1={y(Number(tinta))} y2={y(Number(tinta))} className="ob-grafic-tinta" strokeWidth="1" strokeDasharray="3 3" />
      )}
      <polyline points={puncte.map((p) => `${x(p.i)},${y(Number(p.v))}`).join(' ')} className="ob-grafic-linie" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(ultim.i)} cy={y(Number(ultim.v))} r="3.5" className="ob-grafic-punct" strokeWidth="1.5" />
    </svg>
  )
}

function IconStare({ stare }) {
  const cale = {
    pe_drum: 'M5 8.4l2.1 2.1L11 6',
    la_risc: 'M8 4.8v3.7M8 11v.1',
    sub_tinta: 'M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8',
  }[stare] || 'M5.5 8h5'
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" />
      <path d={cale} />
    </svg>
  )
}

// Formular inline pentru o acțiune (nouă sau existentă).
function FormActiune({ initial, onSalveaza, onAnuleaza }) {
  const [text, setText] = useState(initial?.text || '')
  const [responsabil, setResponsabil] = useState(initial?.responsabil || '')
  const [termen, setTermen] = useState(initial?.termen || '')
  const [eroare, setEroare] = useState('')
  const [salvare, setSalvare] = useState(false)

  const trimite = async (e) => {
    e.preventDefault()
    setSalvare(true)
    setEroare('')
    try {
      await onSalveaza({ text, responsabil, termen })
    } catch (err) {
      setEroare(err.message)
      setSalvare(false)
    }
  }

  return (
    <form className="ob-form-actiune" onSubmit={trimite}>
      <label className="field-label" htmlFor={`act-text-${initial?.id || 'nou'}`}>Acțiune</label>
      <textarea
        id={`act-text-${initial?.id || 'nou'}`}
        className="text-input ob-textarea-mic"
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        required
      />
      <div className="ob-form-rand">
        <div>
          <label className="field-label" htmlFor={`act-resp-${initial?.id || 'nou'}`}>Responsabil</label>
          <input id={`act-resp-${initial?.id || 'nou'}`} className="text-input" value={responsabil} onChange={(e) => setResponsabil(e.target.value)} />
        </div>
        <div>
          <span className="field-label">Termen (gol = continuu)</span>
          <DatePicker value={termen} onChange={setTermen} />
        </div>
      </div>
      {eroare && <p className="ob-eroare">{eroare}</p>}
      <div className="ob-form-actiuni">
        <button type="button" className="btn btn-ghost ob-btn-mic" onClick={onAnuleaza}>Anulează</button>
        <button type="submit" className="btn btn-primary ob-btn-mic" disabled={salvare || !text.trim()}>
          {salvare ? 'Se salvează…' : 'Salvează'}
        </button>
      </div>
    </form>
  )
}

// Formular inline pentru setările obiectivului (țintă, responsabil…).
function FormObiectiv({ obiectiv, pragRisc, onSalveaza, onAnuleaza }) {
  const [f, setF] = useState({
    titlu: obiectiv.titlu || '',
    tinta: obiectiv.tinta ?? '',
    responsabil: obiectiv.responsabil || '',
    resurse: obiectiv.resurse || '',
    evaluare: obiectiv.evaluare || '',
    termen: obiectiv.termen || '',
  })
  const [eroare, setEroare] = useState('')
  const seteaza = (camp) => (e) => setF((x) => ({ ...x, [camp]: e?.target ? e.target.value : e }))
  const ron = obiectiv.unitate === 'RON'
  const id = (camp) => `ob-${obiectiv.id}-${camp}`

  const trimite = async (e) => {
    e.preventDefault()
    setEroare('')
    try {
      await onSalveaza(f)
    } catch (err) {
      setEroare(err.message)
    }
  }

  return (
    <form className="ob-form-obiectiv" onSubmit={trimite}>
      <div>
        <label className="field-label" htmlFor={id('titlu')}>Titlu</label>
        <input id={id('titlu')} className="text-input" value={f.titlu} onChange={seteaza('titlu')} required />
      </div>
      <div>
        <label className="field-label" htmlFor={id('tinta')}>
          Țintă {ron ? '(RON / lună)' : `(${obiectiv.sens === 'max' ? 'maxim' : 'minim'}, %)`}
        </label>
        <input id={id('tinta')} type="number" min="0" step="any" className="text-input" value={f.tinta} onChange={seteaza('tinta')} />
        <p className="ob-detaliu">
          „La risc” = la cel mult {nr(pragRisc * 100)}% de țintă{ron ? ' (ținta lunară se compară proporțional cu zilele scurse)' : ''}.
        </p>
      </div>
      <div className="ob-form-rand">
        <div>
          <label className="field-label" htmlFor={id('resp')}>Responsabil</label>
          <input id={id('resp')} className="text-input" value={f.responsabil} onChange={seteaza('responsabil')} />
        </div>
        <div>
          <span className="field-label">Termen</span>
          <DatePicker value={f.termen} onChange={seteaza('termen')} />
        </div>
      </div>
      <div>
        <label className="field-label" htmlFor={id('res')}>Resurse</label>
        <input id={id('res')} className="text-input" value={f.resurse} onChange={seteaza('resurse')} />
      </div>
      <div>
        <label className="field-label" htmlFor={id('eval')}>Evaluare</label>
        <textarea id={id('eval')} className="text-input ob-textarea-mic" value={f.evaluare} onChange={seteaza('evaluare')} />
      </div>
      {eroare && <p className="ob-eroare">{eroare}</p>}
      <div className="ob-form-actiuni">
        <button type="button" className="btn btn-ghost ob-btn-mic" onClick={onAnuleaza}>Anulează</button>
        <button type="submit" className="btn btn-primary ob-btn-mic">Salvează</button>
      </div>
    </form>
  )
}

// Ce lipsește ca obiectivul să poată fi activat (aceeași regulă ca în baza de date).
function lipsuriActivare(obiectiv, actiuni) {
  const lipsa = []
  if (actiuni.length === 0) lipsa.push('cel puțin o acțiune în plan')
  if (!(obiectiv.resurse || '').trim()) lipsa.push('resursele')
  if (!(obiectiv.evaluare || '').trim()) lipsa.push('metoda de evaluare')
  return lipsa
}

function CardObiectiv({ obiectiv, valoare, inghetata, neinclus, luna, panaLa, pragRisc, serie, actiuni, onReincarca }) {
  const { confirm, dialog } = useConfirm()
  const [editare, setEditare] = useState(false)
  const [actiuneNoua, setActiuneNoua] = useState(false)
  const [actiuneEditata, setActiuneEditata] = useState(null)
  const [eroare, setEroare] = useState('')
  const o = valoare || { ...obiectiv, valoare: null, stare: obiectiv.tinta == null ? 'fara_tinta' : 'fara_date' }
  const stare = STARI[o.stare] || STARI.fara_date
  const s = scala(o)
  const umplere = o.valoare == null ? 0 : Math.min(100, (Number(o.valoare) / s) * 100)
  const tintaAfisata = o.unitate === 'RON' ? o.tinta_efectiva ?? o.tinta : o.tinta
  const pozTinta = tintaAfisata == null ? null : Math.min(100, (Number(tintaAfisata) / s) * 100)
  const realizate = actiuni.filter((a) => a.status === 'realizat').length
  const ron = o.unitate === 'RON'
  const tintaPartiala = ron && o.tinta != null && o.tinta_efectiva != null && Number(o.tinta_efectiva) !== Number(o.tinta)
  const lipsa = lipsuriActivare(obiectiv, actiuni)

  const comutaActiv = () => ruleaza(() => updateObiectiv(obiectiv.id, { activ: !obiectiv.activ }))

  const ruleaza = async (fn) => {
    setEroare('')
    try {
      await fn()
      await onReincarca()
    } catch (err) {
      setEroare(err.message)
    }
  }

  const stergeObiectiv = async () => {
    const ok = await confirm(
      `Ștergi obiectivul „${obiectiv.titlu}” și planul lui de acțiuni? Revizuirile deja confirmate își păstrează valorile.`,
      { title: 'Ștergi obiectivul?', confirmLabel: 'Șterge', danger: true }
    )
    if (ok) await ruleaza(() => deleteObiectiv(obiectiv.id))
  }

  const stergeActiune = async (a) => {
    const ok = await confirm(`Ștergi acțiunea „${a.text}”?`, { title: 'Ștergi acțiunea?', confirmLabel: 'Șterge', danger: true })
    if (ok) await ruleaza(() => deleteActiuneObiectiv(a.id))
  }

  return (
    <article className={`card ob-card ${obiectiv.activ ? '' : 'ob-card-inactiv'}`}>
      <div className="ob-card-antet">
        <span className={`ob-tag ${CATEGORII[obiectiv.categorie] || 'ob-tag-navy'}`}>{obiectiv.categorie}</span>
        {obiectiv.activ ? (
          <span className={`ob-stare ${stare.cls}`}>
            <IconStare stare={o.stare} />
            {stare.label}
          </span>
        ) : (
          <span className="ob-stare ob-stare-neutru">Inactiv</span>
        )}
      </div>

      {!obiectiv.activ && (
        <div className="ob-activare">
          {lipsa.length > 0 ? (
            <p>Pentru activare mai trebuie completate: <strong>{lipsa.join(', ')}</strong>.</p>
          ) : (
            <p>Planul e complet. Activează obiectivul ca să intre în revizuirile săptămânale.</p>
          )}
          <div className="ob-subsol-butoane">
            <button type="button" className="btn btn-primary ob-btn-mic" onClick={comutaActiv} disabled={lipsa.length > 0}>
              Activează obiectivul
            </button>
            <button type="button" className="btn btn-ghost ob-btn-mic" onClick={stergeObiectiv}>
              Șterge obiectivul
            </button>
          </div>
        </div>
      )}

      <h2 className="ob-card-titlu">{obiectiv.titlu}</h2>

      <div className="ob-masura">
        <div className="ob-valoare-rand">
          <span className="ob-valoare">{formatValoare(o)}</span>
          <span className="ob-unitate">{o.unitate}</span>
          <span className="ob-tinta-text">{textTinta(o, obiectiv)}</span>
        </div>
        <div
          className="ob-bara"
          role="img"
          aria-label={`Valoare ${formatValoare(o)} ${o.unitate}, ${textTinta(o, obiectiv)}`}
        >
          <div className={`ob-bara-umplere ${stare.cls}`} style={{ width: `${umplere}%` }} />
          {pozTinta != null && <div className="ob-bara-tinta" style={{ left: `calc(${pozTinta}% - 1.5px)` }} />}
        </div>
        {tintaPartiala && (
          <div className="ob-detaliu">Ținta proporțională până la această dată: {nr(o.tinta_efectiva)} RON</div>
        )}
        <div className="ob-detaliu">{detaliuValoare(o, luna, panaLa)}</div>
        <div className="ob-sursa">
          {neinclus
            ? 'Nu era activ la revizuirea acestei săptămâni — valoare calculată acum'
            : inghetata
              ? `Valori înghețate la revizuirea din ${inghetata}`
              : 'Calculat automat din aplicație'}
        </div>
      </div>

      <div className="ob-tendinta">
        <Grafic
          valori={serie.valori}
          tinta={obiectiv.tinta}
          eticheta={`Evoluția: ${serie.eticheta.toLowerCase()}`}
        />
        <div className="ob-tendinta-text">
          <strong>Tendință</strong>
          {serie.eticheta}. {obiectiv.tinta != null ? 'Linia punctată arată ținta.' : ''}
        </div>
      </div>

      <div className="ob-plan">
        <div className="ob-plan-antet">
          <h3>Plan de acțiuni</h3>
          <span>{actiuni.length ? `${realizate} din ${actiuni.length} realizate` : 'nicio acțiune'}</span>
        </div>
        <ul className="ob-actiuni">
          {actiuni.map((a) =>
            actiuneEditata === a.id ? (
              <li key={a.id} className="ob-actiune">
                <FormActiune
                  initial={a}
                  onSalveaza={async (d) => {
                    await updateActiuneObiectiv(a.id, d)
                    setActiuneEditata(null)
                    await onReincarca()
                  }}
                  onAnuleaza={() => setActiuneEditata(null)}
                />
              </li>
            ) : (
              <li key={a.id} className="ob-actiune">
                <div className="ob-actiune-rand">
                  <span className="ob-actiune-text">{a.text}</span>
                  <select
                    className={`ob-actiune-status ob-act-${a.status}`}
                    value={a.status}
                    onChange={(e) => ruleaza(() => updateActiuneObiectiv(a.id, { status: e.target.value }))}
                    aria-label={`Starea acțiunii: ${a.text}`}
                  >
                    {STATUS_ACTIUNI.map((st) => (
                      <option key={st.id} value={st.id}>{st.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ob-actiune-meta">
                  <span>
                    {a.responsabil || 'fără responsabil'} · {a.termen ? `până la ${dataScurta(a.termen, true)}` : 'continuu'}
                    {a.status === 'realizat' && a.data_realizare ? ` · realizată ${dataScurta(a.data_realizare, true)}` : ''}
                  </span>
                  <span className="ob-actiune-butoane">
                    <button type="button" className="ob-link" onClick={() => setActiuneEditata(a.id)}>Editează</button>
                    <button type="button" className="ob-link ob-link-pericol" onClick={() => stergeActiune(a)}>Șterge</button>
                  </span>
                </div>
              </li>
            )
          )}
        </ul>
        {actiuneNoua ? (
          <FormActiune
            onSalveaza={async (d) => {
              await addActiuneObiectiv(obiectiv.id, d)
              setActiuneNoua(false)
              await onReincarca()
            }}
            onAnuleaza={() => setActiuneNoua(false)}
          />
        ) : (
          <button type="button" className="ob-adauga" onClick={() => setActiuneNoua(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Adaugă acțiune
          </button>
        )}
        {eroare && <p className="ob-eroare">{eroare}</p>}
      </div>

      {editare ? (
        <FormObiectiv
          obiectiv={obiectiv}
          pragRisc={pragRisc}
          onSalveaza={async (f) => {
            await updateObiectiv(obiectiv.id, f)
            setEditare(false)
            await onReincarca()
          }}
          onAnuleaza={() => setEditare(false)}
        />
      ) : (
        <div className="ob-subsol">
          <div className="ob-subsol-text">
            <div><strong>Resurse:</strong> {obiectiv.resurse || '—'}</div>
            <div><strong>Evaluare:</strong> {obiectiv.evaluare || '—'}</div>
          </div>
          <div className="ob-subsol-rand">
            <span>Responsabil: <strong>{obiectiv.responsabil || '—'}</strong></span>
            <span>Termen: <strong>{obiectiv.termen ? dataScurta(obiectiv.termen, true) : '—'}</strong></span>
          </div>
          <div className="ob-subsol-butoane">
            <button type="button" className="btn btn-ghost ob-btn-mic" onClick={() => setEditare(true)}>
              Editează obiectivul
            </button>
            {obiectiv.activ && (
              <button type="button" className="btn btn-ghost ob-btn-mic" onClick={comutaActiv}>
                Dezactivează
              </button>
            )}
          </div>
        </div>
      )}
      {dialog}
    </article>
  )
}

export default function ObiectivePage() {
  const { confirm, dialog } = useConfirm()
  // Ultima săptămână încheiată = cea de dinaintea săptămânii curente.
  const ultimaIncheiata = useMemo(() => adaugaZile(luniaSaptamanii(azi()), -7), [])
  const [luni, setLuni] = useState(ultimaIncheiata)
  const [obiective, setObiective] = useState(null)
  const [calcul, setCalcul] = useState(null)
  const [evolutie, setEvolutie] = useState({ saptamani: [], luni: [] })
  const [actiuni, setActiuni] = useState([])
  const [revizuiri, setRevizuiri] = useState([])
  const [observatii, setObservatii] = useState('')
  const [confirmare, setConfirmare] = useState(false)
  const [eroare, setEroare] = useState('')

  const incarcaConfig = useCallback(async () => {
    const [o, a, r] = await Promise.all([getObiective(), getActiuniObiective(), getRevizuiriObiective()])
    setObiective(o)
    setActiuni(a)
    setRevizuiri(r)
  }, [])

  const incarcaSaptamana = useCallback(async (zi) => {
    setCalcul(null)
    setEroare('')
    try {
      const [c, e] = await Promise.all([getObiectiveSaptamana(zi), getObiectiveEvolutie(zi)])
      setCalcul(c)
      setEvolutie(e)
    } catch (err) {
      setEroare(err.message)
    }
  }, [])

  useEffect(() => {
    incarcaConfig().catch((err) => setEroare(err.message))
  }, [incarcaConfig])

  useEffect(() => {
    incarcaSaptamana(luni)
    setObservatii('')
  }, [luni, incarcaSaptamana])

  const reincarca = async () => {
    await incarcaConfig()
    await incarcaSaptamana(luni)
  }

  const revizuire = revizuiri.find((r) => r.saptamana === luni) || null
  // Săptămână revizuită → valorile înghețate; altfel calculul live.
  const valoriLive = useMemo(() => Object.fromEntries((calcul?.obiective || []).map((v) => [v.obiectiv_id, v])), [calcul])
  const valoriInghetate = useMemo(
    () => (revizuire ? Object.fromEntries((revizuire.valori || []).map((v) => [v.obiectiv_id, v])) : null),
    [revizuire]
  )
  const [creare, setCreare] = useState(false)
  const pragRisc = Number(calcul?.prag_risc ?? 0.1)
  const activeAzi = (obiective || []).filter((o) => o.activ).length

  const serii = useMemo(() => {
    const sapt = evolutie.saptamani || []
    const luniSerie = evolutie.luni || []
    return {
      livrari_la_termen: { valori: sapt.map((s) => s.livrari_la_termen), eticheta: 'Ultimele 8 săptămâni' },
      refaceri: { valori: sapt.map((s) => s.refaceri), eticheta: 'Ultimele 8 săptămâni' },
      valoare_intrata: { valori: luniSerie.map((l) => l.valoare_intrata), eticheta: 'Ultimele 6 luni' },
    }
  }, [evolutie])

  // Istoricul: ultimele 8 săptămâni încheiate, revizuite sau nu.
  const istoric = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const s = adaugaZile(ultimaIncheiata, -7 * i)
        return { luni: s, revizuire: revizuiri.find((r) => r.saptamana === s) || null }
      }),
    [revizuiri, ultimaIncheiata]
  )

  const confirma = async () => {
    const ok = await confirm(
      `Se salvează valorile celor ${activeAzi} obiective active pentru săptămâna ${eticheteSaptamana(luni, true)}, ca înregistrare a monitorizării. După confirmare, înregistrarea nu se mai modifică.`,
      { title: 'Confirmi revizuirea?', confirmLabel: 'Confirmă revizuirea' }
    )
    if (!ok) return
    setConfirmare(true)
    setEroare('')
    try {
      await confirmaRevizuireObiective(luni, observatii)
      await incarcaConfig()
    } catch (err) {
      setEroare(err.message)
    } finally {
      setConfirmare(false)
    }
  }

  const dataRevizuirii = revizuire ? dataOra(revizuire.created_at) : null

  return (
    <div className="ob-pagina">
      <div className="ob-antet">
        <div className="ob-antet-text">
          <span className="ob-chip-patron">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
              <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
            </svg>
            Vizibil doar pentru patron
          </span>
          <TitluCuAjutor id="obiective">Obiective</TitluCuAjutor>
          <p className="ob-hint">Obiectivele companiei, măsurate automat din aplicație. Revizuire în fiecare săptămână.</p>
          {!creare && (
            <button type="button" className="btn btn-primary ob-buton-nou" onClick={() => setCreare(true)}>
              + Obiectiv nou
            </button>
          )}
        </div>
        <div className="ob-saptamana">
          <button type="button" className="ob-sageata" onClick={() => setLuni(adaugaZile(luni, -7))} aria-label="Săptămâna anterioară">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3.5L5.5 8l4.5 4.5" />
            </svg>
          </button>
          <div className="ob-saptamana-text">
            <span>Săptămâna revizuită</span>
            <strong>{eticheteSaptamana(luni, true)}</strong>
          </div>
          <button
            type="button"
            className="ob-sageata"
            onClick={() => setLuni(adaugaZile(luni, 7))}
            disabled={luni >= ultimaIncheiata}
            aria-label="Săptămâna următoare"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3.5L10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
      </div>

      {eroare && <p className="ob-eroare">{eroare}</p>}

      {creare && (
        <FormObiectivNou
          onCreat={async () => {
            setCreare(false)
            await reincarca()
          }}
          onAnuleaza={() => setCreare(false)}
        />
      )}

      {obiective === null || (calcul === null && !eroare) ? (
        <p className="ob-hint">Se calculează…</p>
      ) : (
        <div className="ob-carduri">
          {obiective.map((ob) => (
            <CardObiectiv
              key={ob.id}
              obiectiv={ob}
              valoare={valoriInghetate?.[ob.id] || valoriLive[ob.id]}
              inghetata={valoriInghetate?.[ob.id] ? dataRevizuirii : null}
              neinclus={!!valoriInghetate && !valoriInghetate[ob.id]}
              pragRisc={pragRisc}
              luna={calcul?.luna}
              panaLa={calcul?.pana_la}
              serie={serii[ob.indicator] || { valori: [], eticheta: '' }}
              actiuni={actiuni.filter((a) => a.obiectiv_id === ob.id)}
              onReincarca={reincarca}
            />
          ))}
        </div>
      )}

      <section className="card ob-revizuire">
        <div className="ob-revizuire-stanga">
          <h2>Revizuire săptămânală</h2>
          {revizuire ? (
            <>
              <span className="ob-revizuita">
                <IconStare stare="pe_drum" />
                Revizuită pe {dataRevizuirii} de {revizuire.revizuita_de || 'patron'}
              </span>
              <div>
                <span className="field-label">Observații și decizii</span>
                <p className="ob-observatii">{revizuire.observatii || 'Fără observații.'}</p>
              </div>
            </>
          ) : (
            <>
              <p className="ob-hint">
                Confirmarea salvează valorile de mai sus ca înregistrare a monitorizării, cu data și observațiile tale. Rămâne ca dovadă
                pentru audit și pentru analiza managementului.
              </p>
              <label className="field-label" htmlFor="ob-observatii">Observații și decizii (opțional)</label>
              <textarea
                id="ob-observatii"
                className="text-input ob-textarea"
                rows={3}
                value={observatii}
                onChange={(e) => setObservatii(e.target.value)}
                placeholder="Ex.: Livrările la termen sunt la risc, prioritizăm comenzile cu termen în 48 h."
              />
              {activeAzi === 0 && (
                <p className="ob-eroare">Niciun obiectiv activ. Completează planul unui obiectiv și activează-l înainte de revizuire.</p>
              )}
              <div className="ob-revizuire-actiuni">
                <button type="button" className="btn btn-primary" onClick={confirma} disabled={confirmare || !calcul || activeAzi === 0}>
                  {confirmare ? 'Se salvează…' : 'Confirmă revizuirea'}
                </button>
                <span className="ob-hint">După confirmare, înregistrarea nu se mai modifică.</span>
              </div>
            </>
          )}
        </div>
        <div className="ob-revizuire-dreapta">
          <h3>Istoric revizuiri</h3>
          <ul className="ob-istoric">
            {istoric.map(({ luni: s, revizuire: r }) => (
              <li key={s}>
                <button type="button" className={`ob-istoric-rand ${s === luni ? 'ob-istoric-activ' : ''}`} onClick={() => setLuni(s)}>
                  <span>{eticheteSaptamana(s)}</span>
                  <span className={`ob-istoric-stare ${r ? 'ob-stare-ok' : 'ob-stare-risc'}`}>
                    {r ? `Revizuită ${dataOra(r.created_at)}` : 'Nerevizuită'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {dialog}
    </div>
  )
}
