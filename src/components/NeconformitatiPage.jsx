import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  getNeconformitati,
  addNeconformitate,
  updateNeconformitate,
  deleteNeconformitate,
  getCostNeconformitate,
  saveCostNeconformitate,
  creeazaRefacere,
  getEtapeProductie,
  getTehnicieni,
  getFurnizori,
} from '../services/dataService'
import { TIPURI_NC, GRAVITATI_NC, STATUSURI_NC, TIP_NC, GRAVITATE_NC, STATUS_NC } from '../utils/calitate'
import { areAccesOperational, estePatron } from '../utils/roluri'
import { azi } from '../utils/date'
import { useConfirm } from '../hooks/useConfirm.jsx'
import DatePicker from './DatePicker.jsx'
import './Registru.css'

function formatData(iso) {
  if (!iso) return '—'
  const [an, luna, zi] = iso.slice(0, 10).split('-')
  return `${zi}.${luna}.${an}`
}

function formatDataOra(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const lei = (n) => `${Math.round(Number(n) || 0).toLocaleString('ro-RO')} RON`

function Valoare({ eticheta, children, lata }) {
  return (
    <div className={lata ? 'registru-camp-lat' : undefined}>
      <span className="field-label">{eticheta}</span>
      <div className="registru-valoare">{children || '—'}</div>
    </div>
  )
}

const GOL = {
  data_constatare: '',
  tip: 'productie',
  gravitate: 'minora',
  comanda_id: '',
  etapa_id: '',
  tehnician_id: '',
  furnizor_id: '',
  nota_id: null,
  descriere: '',
  actiune_imediata: '',
  cauza: '',
  actiune_corectiva: '',
  responsabil: '',
  termen: '',
  status: 'deschisa',
}

// Costul refacerii / neconformității — doar patronul (tabel separat).
function CostNc({ ncId }) {
  const [cost, setCost] = useState(null)
  const [mesaj, setMesaj] = useState('')

  useEffect(() => {
    getCostNeconformitate(ncId).then((c) => setCost({ ...c, observatii: c.observatii || '' }))
  }, [ncId])

  if (!cost) return null
  const total = (Number(cost.cost_material) || 0) + (Number(cost.cost_manopera) || 0)
  const seteaza = (camp) => (e) => setCost((c) => ({ ...c, [camp]: e.target.value }))

  const salveaza = async () => {
    setMesaj('')
    try {
      await saveCostNeconformitate(ncId, cost)
      setMesaj('Cost salvat.')
    } catch (err) {
      setMesaj(err.message)
    }
  }

  return (
    <div className="registru-cost">
      <div>
        <label className="field-label" htmlFor="nc-cost-mat">Cost material (RON)</label>
        <input id="nc-cost-mat" type="number" min="0" className="text-input" value={cost.cost_material} onChange={seteaza('cost_material')} />
      </div>
      <div>
        <label className="field-label" htmlFor="nc-cost-man">Cost manoperă (RON)</label>
        <input id="nc-cost-man" type="number" min="0" className="text-input" value={cost.cost_manopera} onChange={seteaza('cost_manopera')} />
      </div>
      <Valoare eticheta="Total (vizibil doar patronului)">{lei(total)}</Valoare>
      <div className="registru-camp-2">
        <label className="field-label" htmlFor="nc-cost-obs">Observații cost</label>
        <input id="nc-cost-obs" className="text-input" value={cost.observatii} onChange={seteaza('observatii')} />
      </div>
      <div>
        <button type="button" className="btn btn-secondary" onClick={salveaza}>Salvează costul</button>
        {mesaj && <p className={mesaj === 'Cost salvat.' ? 'registru-ok' : 'registru-eroare'}>{mesaj}</p>}
      </div>
    </div>
  )
}

// „Creează refacere" — comandă nouă cu datele comenzii neconforme.
function RefacereNc({ nc, lucrari, onCreata, onOpenLucrare }) {
  const { confirm, dialog } = useConfirm()
  const [facturata, setFacturata] = useState(false)
  const [comisioane, setComisioane] = useState(true)
  const [ocupat, setOcupat] = useState(false)
  const [eroare, setEroare] = useState('')
  const refacere = nc.refacere_comanda_id ? lucrari.find((l) => l.id === nc.refacere_comanda_id) : null

  if (nc.refacere_comanda_id) {
    return (
      <div className="registru-refacere">
        <span>
          Refacere creată: <strong>{refacere?.nr_inregistrare || 'comanda nu mai e disponibilă'}</strong>
        </span>
        {refacere && (
          <button type="button" className="btn btn-secondary" onClick={() => onOpenLucrare(refacere)}>
            Deschide fișa refacerii
          </button>
        )}
      </div>
    )
  }
  if (!nc.comanda_id) return null

  const creeaza = async () => {
    const ok = await confirm(
      `Se creează o comandă nouă cu datele comenzii ${nc.comanda_nr} (${nc.pacient || '—'}). ` +
        `${facturata ? 'Se facturează medicului.' : 'Nu se facturează medicului (încasare 0).'} ` +
        `${comisioane ? 'Tehnicienii primesc comisioanele.' : 'Fără comisioane pentru tehnicieni.'}`,
      { title: 'Creezi refacerea?', confirmLabel: 'Creează refacerea' }
    )
    if (!ok) return
    setOcupat(true)
    setEroare('')
    try {
      await creeazaRefacere(nc.id, { facturata, comisioane })
      await onCreata()
    } catch (err) {
      setEroare(err.message)
    } finally {
      setOcupat(false)
    }
  }

  return (
    <div className="registru-refacere">
      <strong>Refacere</strong>
      <label className="registru-optiune">
        <input type="checkbox" checked={facturata} onChange={(e) => setFacturata(e.target.checked)} />
        Se facturează medicului
      </label>
      <label className="registru-optiune">
        <input type="checkbox" checked={comisioane} onChange={(e) => setComisioane(e.target.checked)} />
        Se plătesc comisioanele tehnicienilor
      </label>
      <button type="button" className="btn btn-primary" onClick={creeaza} disabled={ocupat}>
        {ocupat ? 'Se creează…' : 'Creează refacere'}
      </button>
      {eroare && <p className="registru-eroare">{eroare}</p>}
      {dialog}
    </div>
  )
}

// Fișa unei neconformități — editabilă pentru patron/coordonator; tehnicianul
// completează doar raportarea (fără analiză) și apoi o vede doar de citit.
function FisaNc({ nc, precompletare, profile, lucrari, etape, tehnicieni, furnizori, onSalvat, onAnulare, onSters, onOpenLucrare, onReincarca }) {
  const { confirm, dialog } = useConfirm()
  const operational = areAccesOperational(profile)
  const patron = estePatron(profile)
  const nou = !nc?.id
  const editabil = operational || nou
  const [form, setForm] = useState(() => {
    const baza = { ...GOL, data_constatare: azi(), ...(nc || {}), ...(precompletare || {}) }
    for (const k of Object.keys(GOL)) if (baza[k] == null && k !== 'nota_id') baza[k] = ''
    return baza
  })
  const [salvare, setSalvare] = useState(false)
  const [eroare, setEroare] = useState('')

  const seteaza = (camp) => (e) => setForm((f) => ({ ...f, [camp]: e?.target ? e.target.value : e }))

  const salveaza = async (e) => {
    e.preventDefault()
    setSalvare(true)
    setEroare('')
    try {
      const rezultat = nou ? await addNeconformitate(form) : await updateNeconformitate(nc.id, form)
      await onSalvat(rezultat)
    } catch (err) {
      setEroare(err.message)
    } finally {
      setSalvare(false)
    }
  }

  const sterge = async () => {
    const ok = await confirm(`Ștergi definitiv neconformitatea ${nc.numar}?`, { title: 'Ștergi neconformitatea?', confirmLabel: 'Șterge', danger: true })
    if (!ok) return
    try {
      await deleteNeconformitate(nc.id)
      await onSters()
    } catch (err) {
      setEroare(err.message)
    }
  }

  const numeDupaId = (lista, id) => lista.find((x) => x.id === id)?.nume
  const comanda = lucrari.find((l) => l.id === form.comanda_id)
  // Comenzile pentru alegere: cele mai noi primele.
  const optiuniComenzi = useMemo(
    () => [...lucrari].sort((a, b) => (b.nr_inregistrare || '').localeCompare(a.nr_inregistrare || '', 'ro', { numeric: true })),
    [lucrari]
  )

  if (!editabil) {
    return (
      <div className="registru-fisa">
        <div className="registru-fisa-grid">
          <Valoare eticheta="Tip">{TIP_NC[nc.tip]?.label}</Valoare>
          <Valoare eticheta="Gravitate">{GRAVITATE_NC[nc.gravitate]?.label}</Valoare>
          <Valoare eticheta="Stare">{STATUS_NC[nc.status]?.label}</Valoare>
          <Valoare eticheta="Comandă">{nc.comanda_nr ? `${nc.comanda_nr} · ${nc.pacient || '—'}` : ''}</Valoare>
          <Valoare eticheta="Etapă">{numeDupaId(etape, nc.etapa_id)}</Valoare>
          <Valoare eticheta="Furnizor">{numeDupaId(furnizori, nc.furnizor_id)}</Valoare>
          <Valoare eticheta="Descriere" lata>{nc.descriere}</Valoare>
          <Valoare eticheta="Ce s-a făcut imediat" lata>{nc.actiune_imediata}</Valoare>
          <p className="registru-info">Raportată de {nc.raportata_de_nume} · {formatDataOra(nc.created_at)}</p>
        </div>
        <div className="registru-fisa-actiuni">
          <button type="button" className="btn btn-ghost" onClick={onAnulare}>Închide</button>
        </div>
      </div>
    )
  }

  return (
    <form className="registru-fisa" onSubmit={salveaza}>
      <div className="registru-fisa-grid">
        <h4 className="registru-sectiune">Ce s-a întâmplat</h4>
        <div>
          <label className="field-label">Data constatării</label>
          <DatePicker value={form.data_constatare} onChange={seteaza('data_constatare')} />
        </div>
        <div>
          <label className="field-label" htmlFor="nc-tip">Tip</label>
          <select id="nc-tip" className="text-input" value={form.tip} onChange={seteaza('tip')}>
            {TIPURI_NC.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="nc-grav">Gravitate</label>
          <select id="nc-grav" className="text-input" value={form.gravitate} onChange={seteaza('gravitate')}>
            {GRAVITATI_NC.map((g) => (
              <option key={g.id} value={g.id}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="nc-comanda">Comandă</label>
          <select id="nc-comanda" className="text-input" value={form.comanda_id} onChange={seteaza('comanda_id')}>
            <option value="">— fără comandă —</option>
            {!comanda && form.comanda_id && <option value={form.comanda_id}>{nc?.comanda_nr || 'Comandă indisponibilă'}</option>}
            {optiuniComenzi.map((l) => (
              <option key={l.id} value={l.id}>{l.nr_inregistrare} · {l.pacient || '—'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="nc-etapa">Etapa</label>
          <select id="nc-etapa" className="text-input" value={form.etapa_id} onChange={seteaza('etapa_id')}>
            <option value="">—</option>
            {etape.map((e) => (
              <option key={e.id} value={e.id}>{e.nume}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="nc-teh">Tehnician implicat</label>
          <select id="nc-teh" className="text-input" value={form.tehnician_id} onChange={seteaza('tehnician_id')}>
            <option value="">—</option>
            {tehnicieni.map((t) => (
              <option key={t.id} value={t.id}>{t.nume}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="nc-furnizor">Furnizor / material</label>
          <select id="nc-furnizor" className="text-input" value={form.furnizor_id} onChange={seteaza('furnizor_id')}>
            <option value="">—</option>
            {furnizori.filter((f) => f.activ || f.id === form.furnizor_id).map((f) => (
              <option key={f.id} value={f.id}>{f.nume}</option>
            ))}
          </select>
        </div>
        {comanda && (
          <p className="registru-info registru-camp-2">
            Medic: {comanda.medic || '—'} · Tip: {comanda.tip_lucrare}{' '}
            <button type="button" className="btn btn-ghost" onClick={() => onOpenLucrare(comanda)}>Deschide fișa comenzii</button>
          </p>
        )}
        <div className="registru-camp-lat">
          <label className="field-label" htmlFor="nc-descriere">Descriere *</label>
          <textarea id="nc-descriere" className="text-input registru-text" value={form.descriere} onChange={seteaza('descriere')} maxLength={2000} required />
        </div>
        <div className="registru-camp-lat">
          <label className="field-label" htmlFor="nc-imediat">Ce s-a făcut imediat</label>
          <textarea id="nc-imediat" className="text-input registru-text" value={form.actiune_imediata} onChange={seteaza('actiune_imediata')} placeholder="ex. refacere, ajustare, retușare…" />
        </div>

        {operational && (
          <>
            <h4 className="registru-sectiune">Analiză (opțional)</h4>
            <div className="registru-camp-lat">
              <label className="field-label" htmlFor="nc-cauza">Cauza</label>
              <textarea id="nc-cauza" className="text-input registru-text" value={form.cauza} onChange={seteaza('cauza')} />
            </div>
            <div className="registru-camp-lat">
              <label className="field-label" htmlFor="nc-corectiva">Acțiune ca să nu se mai repete</label>
              <textarea id="nc-corectiva" className="text-input registru-text" value={form.actiune_corectiva} onChange={seteaza('actiune_corectiva')} />
            </div>
            <div>
              <label className="field-label" htmlFor="nc-resp">Responsabil</label>
              <input id="nc-resp" className="text-input" value={form.responsabil} onChange={seteaza('responsabil')} />
            </div>
            <div>
              <label className="field-label">Termen</label>
              <DatePicker value={form.termen} onChange={seteaza('termen')} />
            </div>
            <div>
              <label className="field-label" htmlFor="nc-status">Stare</label>
              <select id="nc-status" className="text-input" value={form.status} onChange={seteaza('status')}>
                {STATUSURI_NC.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {!nou && (
          <p className="registru-info">
            Raportată de {nc.raportata_de_nume} · {formatDataOra(nc.created_at)}
            {nc.status === 'inchisa' && nc.data_inchidere && ` · Închisă de ${nc.inchisa_de} · ${formatDataOra(nc.data_inchidere)}`}
            {nc.nota_id && ' · Pornită dintr-o notă a medicului'}
          </p>
        )}
        {!nou && operational && <RefacereNc nc={nc} lucrari={lucrari} onCreata={onReincarca} onOpenLucrare={onOpenLucrare} />}
        {!nou && patron && <CostNc ncId={nc.id} />}
      </div>
      {eroare && <p className="registru-eroare">{eroare}</p>}
      <div className="registru-fisa-actiuni">
        {!nou && patron && (
          <button type="button" className="btn btn-outline-danger registru-btn-stanga" onClick={sterge}>
            Șterge
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onAnulare}>
          {nou ? 'Anulează' : 'Închide'}
        </button>
        <button type="submit" className="btn btn-primary" disabled={salvare}>
          {salvare ? 'Se salvează…' : nou ? 'Înregistrează' : 'Salvează'}
        </button>
      </div>
      {dialog}
    </form>
  )
}

function Sumar({ titlu, randuri }) {
  return (
    <div className="card registru-sumar-card">
      <h4>{titlu}</h4>
      {randuri.length === 0 ? (
        <p className="registru-info">—</p>
      ) : (
        <ul>
          {randuri.map(([nume, nr]) => (
            <li key={nume}>
              <span>{nume}</span>
              <strong>{nr}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function numara(lista, cheie) {
  const m = new Map()
  for (const x of lista) {
    const k = cheie(x)
    if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

// Registrul neconformităților — tabel simplu; clic pe un rând deschide fișa
// completă sub el. Tehnicianul vede doar ce a raportat el.
// `precompletare` — din tabul Note („Înregistrează neconformitate").
export default function NeconformitatiPage({ profile, lucrari, precompletare, onPrecompletareFolosita, onOpenLucrare }) {
  const operational = areAccesOperational(profile)
  const [lista, setLista] = useState(null)
  const [etape, setEtape] = useState([])
  const [tehnicieni, setTehnicieni] = useState([])
  const [furnizori, setFurnizori] = useState([])
  const [deschis, setDeschis] = useState(precompletare ? 'nou' : null)
  const [prefill, setPrefill] = useState(precompletare || null)
  const [filtruStatus, setFiltruStatus] = useState('active')
  const [filtruTip, setFiltruTip] = useState('')
  const [deLa, setDeLa] = useState('')
  const [panaLa, setPanaLa] = useState('')

  const load = useCallback(async () => setLista(await getNeconformitati()), [])

  useEffect(() => {
    load()
    Promise.all([getEtapeProductie(), getTehnicieni(), getFurnizori()]).then(([e, t, f]) => {
      setEtape(e)
      setTehnicieni(t)
      setFurnizori(f)
    })
  }, [load])

  useEffect(() => {
    if (precompletare) {
      setPrefill(precompletare)
      setDeschis('nou')
      onPrecompletareFolosita?.()
    }
  }, [precompletare, onPrecompletareFolosita])

  const filtrate = useMemo(
    () =>
      (lista || []).filter(
        (n) =>
          (filtruStatus === 'toate' || (filtruStatus === 'active' ? n.status !== 'inchisa' : n.status === filtruStatus)) &&
          (!filtruTip || n.tip === filtruTip) &&
          (!deLa || n.data_constatare >= deLa) &&
          (!panaLa || n.data_constatare <= panaLa)
      ),
    [lista, filtruStatus, filtruTip, deLa, panaLa]
  )

  const numeEtapa = (id) => etape.find((e) => e.id === id)?.nume
  const numeTehnician = (id) => tehnicieni.find((t) => t.id === id)?.nume
  const numeFurnizor = (id) => furnizori.find((f) => f.id === id)?.nume

  const dupaSalvare = async (nc) => {
    await load()
    setPrefill(null)
    setDeschis(nc?.id || null)
  }

  const propsFisa = {
    profile,
    lucrari,
    etape,
    tehnicieni,
    furnizori,
    onOpenLucrare,
    onSalvat: dupaSalvare,
    onReincarca: load,
  }

  return (
    <div className="registru">
      <div className="registru-antet">
        <div>
          <h2>Neconformități</h2>
          <p className="registru-hint">
            {operational
              ? 'Registrul problemelor: greșeli în producție, reclamații, materiale defecte.'
              : 'Raportează o problemă constatată. Aici vezi neconformitățile raportate de tine.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setPrefill(null)
            setDeschis('nou')
          }}
        >
          + Raportează neconformitate
        </button>
      </div>

      {deschis === 'nou' && (
        <div className="card registru-nou">
          <h3>Neconformitate nouă</h3>
          <FisaNc key={prefill?.nota_id || 'nou'} nc={null} precompletare={prefill} {...propsFisa} onAnulare={() => setDeschis(null)} onSters={() => {}} />
        </div>
      )}

      <div className="registru-filtre">
        <select className="text-input" value={filtruStatus} onChange={(e) => setFiltruStatus(e.target.value)} aria-label="Stare">
          <option value="active">Deschise și în lucru</option>
          <option value="toate">Toate</option>
          {STATUSURI_NC.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select className="text-input" value={filtruTip} onChange={(e) => setFiltruTip(e.target.value)} aria-label="Tip">
          <option value="">Toate tipurile</option>
          {TIPURI_NC.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span className="registru-info">De la</span>
        <DatePicker value={deLa} onChange={setDeLa} />
        <span className="registru-info">până la</span>
        <DatePicker value={panaLa} onChange={setPanaLa} />
      </div>

      {operational && lista && filtrate.length > 0 && (
        <div className="registru-sumar">
          <Sumar titlu="Pe tip" randuri={numara(filtrate, (n) => TIP_NC[n.tip]?.label)} />
          <Sumar titlu="Pe etapă" randuri={numara(filtrate, (n) => numeEtapa(n.etapa_id))} />
          <Sumar titlu="Pe tehnician" randuri={numara(filtrate, (n) => numeTehnician(n.tehnician_id))} />
          <Sumar titlu="Pe furnizor" randuri={numara(filtrate, (n) => numeFurnizor(n.furnizor_id))} />
        </div>
      )}

      <div className="card registru-tabel-wrap">
        {lista === null ? (
          <p className="registru-gol">Se încarcă…</p>
        ) : filtrate.length === 0 ? (
          <p className="registru-gol">{lista.length === 0 ? 'Nicio neconformitate înregistrată.' : 'Nicio neconformitate nu corespunde filtrelor.'}</p>
        ) : (
          <table className="registru-tabel">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Data</th>
                <th className="registru-col-optional">Tip</th>
                <th>Comandă</th>
                <th className="registru-col-optional">Descriere</th>
                <th>Gravitate</th>
                <th>Stare</th>
              </tr>
            </thead>
            <tbody>
              {filtrate.map((n) => (
                <Fragment key={n.id}>
                  <tr
                    className={`registru-rand ${deschis === n.id ? 'registru-rand-deschis' : ''}`}
                    onClick={() => setDeschis(deschis === n.id ? null : n.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setDeschis(deschis === n.id ? null : n.id)}
                    aria-expanded={deschis === n.id}
                  >
                    <td className="registru-principal">{n.numar}</td>
                    <td>{formatData(n.data_constatare)}</td>
                    <td className="registru-col-optional">{TIP_NC[n.tip]?.label}</td>
                    <td>{n.comanda_nr ? `${n.comanda_nr} · ${n.pacient || '—'}` : '—'}</td>
                    <td className="registru-col-optional registru-descriere">{n.descriere}</td>
                    <td><span className={`badge ${GRAVITATE_NC[n.gravitate]?.badge}`}>{GRAVITATE_NC[n.gravitate]?.label}</span></td>
                    <td><span className={`badge ${STATUS_NC[n.status]?.badge}`}>{STATUS_NC[n.status]?.label}</span></td>
                  </tr>
                  {deschis === n.id && (
                    <tr className="registru-rand-fisa">
                      <td colSpan={7}>
                        <FisaNc
                          nc={n}
                          {...propsFisa}
                          onAnulare={() => setDeschis(null)}
                          onSters={async () => {
                            setDeschis(null)
                            await load()
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
