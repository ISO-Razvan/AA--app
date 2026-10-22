import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getFurnizori, addFurnizor, updateFurnizor, deleteFurnizor } from '../services/dataService'
import { CATEGORII_FURNIZORI } from '../utils/calitate'
import { useConfirm } from '../hooks/useConfirm.jsx'
import { TitluCuAjutor } from '../ajutor/Ajutor.jsx'
import './Registru.css'

const GOL = {
  nume: '',
  cui: '',
  persoana_contact: '',
  telefon: '',
  email: '',
  adresa: '',
  categorii: [],
  termen_livrare_zile: '',
  observatii: '',
  activ: true,
}

// Fișa unui furnizor, deschisă sub rândul lui în registru (sau sus, la unul nou).
function FisaFurnizor({ furnizor, onSalvat, onAnulare, onSters }) {
  const { confirm, dialog } = useConfirm()
  const [form, setForm] = useState(() => ({ ...GOL, ...furnizor, termen_livrare_zile: furnizor?.termen_livrare_zile ?? '' }))
  const [salvare, setSalvare] = useState(false)
  const [eroare, setEroare] = useState('')
  const nou = !furnizor?.id

  const seteaza = (camp) => (e) => setForm((f) => ({ ...f, [camp]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const comutaCategorie = (c) =>
    setForm((f) => ({ ...f, categorii: f.categorii.includes(c) ? f.categorii.filter((x) => x !== c) : [...f.categorii, c] }))

  const salveaza = async (e) => {
    e.preventDefault()
    setSalvare(true)
    setEroare('')
    try {
      const rezultat = nou ? await addFurnizor(form) : await updateFurnizor(furnizor.id, form)
      await onSalvat(rezultat)
    } catch (err) {
      setEroare(err.message)
    } finally {
      setSalvare(false)
    }
  }

  const sterge = async () => {
    const ok = await confirm(`Ștergi furnizorul ${furnizor.nume}? Neconformitățile legate de el rămân, fără furnizor.`, {
      title: 'Ștergi furnizorul?',
      confirmLabel: 'Șterge',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteFurnizor(furnizor.id)
      await onSters()
    } catch (err) {
      setEroare(err.message)
    }
  }

  return (
    <form className="registru-fisa" onSubmit={salveaza}>
      <div className="registru-fisa-grid">
        <div className="registru-camp-lat">
          <label className="field-label" htmlFor="f-nume">Nume *</label>
          <input id="f-nume" className="text-input" value={form.nume} onChange={seteaza('nume')} required autoFocus={nou} />
        </div>
        <div>
          <label className="field-label" htmlFor="f-cui">CUI</label>
          <input id="f-cui" className="text-input" value={form.cui || ''} onChange={seteaza('cui')} />
        </div>
        <div>
          <label className="field-label" htmlFor="f-termen">Termen obișnuit de livrare (zile)</label>
          <input id="f-termen" type="number" min="0" className="text-input" value={form.termen_livrare_zile} onChange={seteaza('termen_livrare_zile')} />
        </div>
        <div>
          <label className="field-label" htmlFor="f-contact">Persoană de contact</label>
          <input id="f-contact" className="text-input" value={form.persoana_contact || ''} onChange={seteaza('persoana_contact')} />
        </div>
        <div>
          <label className="field-label" htmlFor="f-telefon">Telefon</label>
          <input id="f-telefon" type="tel" className="text-input" value={form.telefon || ''} onChange={seteaza('telefon')} />
        </div>
        <div>
          <label className="field-label" htmlFor="f-email">Email</label>
          <input id="f-email" type="email" className="text-input" value={form.email || ''} onChange={seteaza('email')} />
        </div>
        <div className="registru-camp-lat">
          <label className="field-label" htmlFor="f-adresa">Adresă</label>
          <input id="f-adresa" className="text-input" value={form.adresa || ''} onChange={seteaza('adresa')} />
        </div>
        <div className="registru-camp-lat">
          <span className="field-label">Ce livrează</span>
          <div className="registru-optiuni">
            {CATEGORII_FURNIZORI.map((c) => (
              <label key={c} className="registru-optiune">
                <input type="checkbox" checked={form.categorii.includes(c)} onChange={() => comutaCategorie(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div className="registru-camp-lat">
          <label className="field-label" htmlFor="f-obs">Observații</label>
          <textarea id="f-obs" className="text-input registru-text" value={form.observatii || ''} onChange={seteaza('observatii')} />
        </div>
        <label className="registru-optiune">
          <input type="checkbox" checked={form.activ} onChange={seteaza('activ')} />
          Furnizor activ
        </label>
      </div>
      {eroare && <p className="registru-eroare">{eroare}</p>}
      <div className="registru-fisa-actiuni">
        {!nou && (
          <button type="button" className="btn btn-outline-danger registru-btn-stanga" onClick={sterge}>
            Șterge furnizorul
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onAnulare}>
          {nou ? 'Anulează' : 'Închide'}
        </button>
        <button type="submit" className="btn btn-primary" disabled={salvare}>
          {salvare ? 'Se salvează…' : nou ? 'Adaugă furnizorul' : 'Salvează'}
        </button>
      </div>
      {dialog}
    </form>
  )
}

// Agenda furnizorilor — registru simplu; clic pe un rând deschide fișa sub el.
export default function FurnizoriPage() {
  const [furnizori, setFurnizori] = useState(null)
  const [deschis, setDeschis] = useState(null) // id sau 'nou'
  const [cautare, setCautare] = useState('')
  const [categorie, setCategorie] = useState('')
  const [doarActivi, setDoarActivi] = useState(true)

  const load = useCallback(async () => setFurnizori(await getFurnizori()), [])
  useEffect(() => {
    load()
  }, [load])

  const afisati = useMemo(() => {
    const q = cautare.trim().toLowerCase()
    return (furnizori || []).filter(
      (f) =>
        (!doarActivi || f.activ) &&
        (!categorie || f.categorii.includes(categorie)) &&
        (!q || [f.nume, f.persoana_contact, f.telefon, f.email, f.cui].some((x) => (x || '').toLowerCase().includes(q)))
    )
  }, [furnizori, cautare, categorie, doarActivi])

  const dupaSalvare = async (f) => {
    await load()
    setDeschis(f?.id || null)
  }

  return (
    <div className="registru">
      <div className="registru-antet">
        <div>
          <TitluCuAjutor id="furnizori">Furnizori</TitluCuAjutor>
          <p className="registru-hint">Agenda furnizorilor laboratorului.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDeschis('nou')}>
          + Furnizor nou
        </button>
      </div>

      <div className="registru-filtre">
        <input className="text-input" placeholder="Caută după nume, contact, telefon, CUI…" value={cautare} onChange={(e) => setCautare(e.target.value)} />
        <select className="text-input" value={categorie} onChange={(e) => setCategorie(e.target.value)} aria-label="Categorie">
          <option value="">Toate categoriile</option>
          {CATEGORII_FURNIZORI.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="registru-optiune">
          <input type="checkbox" checked={doarActivi} onChange={(e) => setDoarActivi(e.target.checked)} />
          Doar activi
        </label>
      </div>

      {deschis === 'nou' && (
        <div className="card registru-nou">
          <h3>Furnizor nou</h3>
          <FisaFurnizor furnizor={null} onSalvat={dupaSalvare} onAnulare={() => setDeschis(null)} onSters={() => {}} />
        </div>
      )}

      <div className="card registru-tabel-wrap">
        {furnizori === null ? (
          <p className="registru-gol">Se încarcă…</p>
        ) : afisati.length === 0 ? (
          <p className="registru-gol">{furnizori.length === 0 ? 'Niciun furnizor adăugat încă.' : 'Niciun furnizor nu corespunde filtrelor.'}</p>
        ) : (
          <table className="registru-tabel">
            <thead>
              <tr>
                <th>Nume</th>
                <th>Ce livrează</th>
                <th className="registru-col-optional">Contact</th>
                <th>Telefon</th>
                <th className="registru-col-optional">Email</th>
                <th className="registru-col-optional">Livrare</th>
              </tr>
            </thead>
            <tbody>
              {afisati.map((f) => (
                <Fragment key={f.id}>
                  <tr
                    className={`registru-rand ${deschis === f.id ? 'registru-rand-deschis' : ''} ${f.activ ? '' : 'registru-rand-inactiv'}`}
                    onClick={() => setDeschis(deschis === f.id ? null : f.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setDeschis(deschis === f.id ? null : f.id)}
                    aria-expanded={deschis === f.id}
                  >
                    <td className="registru-principal">
                      {f.nume}
                      {!f.activ && <span className="badge badge-neutral registru-badge-mic">Inactiv</span>}
                    </td>
                    <td>{f.categorii.join(', ') || '—'}</td>
                    <td className="registru-col-optional">{f.persoana_contact || '—'}</td>
                    <td>{f.telefon || '—'}</td>
                    <td className="registru-col-optional">{f.email || '—'}</td>
                    <td className="registru-col-optional">{f.termen_livrare_zile != null ? `${f.termen_livrare_zile} zile` : '—'}</td>
                  </tr>
                  {deschis === f.id && (
                    <tr className="registru-rand-fisa">
                      <td colSpan={6}>
                        <FisaFurnizor
                          furnizor={f}
                          onSalvat={dupaSalvare}
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
