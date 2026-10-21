import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMedici, updateMedic, getAccesMedici, accesMedic, getLucrari, addConfigValue } from '../services/dataService'
import { linkAccesMedic, trimiteLinkAccesMedic } from '../services/notificari'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './MediciSetup.css'

const STARE = {
  fara: { label: 'Fără acces', badge: 'badge-neutral' },
  activ: { label: 'Acces activ', badge: 'badge-success' },
  dezactivat: { label: 'Dezactivat', badge: 'badge-danger' },
}

// Setup → Medici: emailul și telefonul fiecărui medic + accesul lui la pagina
// medicului (/medic). Contul se creează din server (worker /api/acces-medic);
// medicul se autentifică fără parolă, cu un cod primit pe email.
export default function MediciSetup() {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [medici, setMedici] = useState(null)
  const [acces, setAcces] = useState(new Map())
  const [numePeComenzi, setNumePeComenzi] = useState([])
  const [ciorne, setCiorne] = useState({}) // id → { email, telefon }
  const [ocupat, setOcupat] = useState(null) // id-ul medicului cu o acțiune în curs
  const [mesaje, setMesaje] = useState({}) // id → { tip: 'ok' | 'eroare', text }
  const [linkuri, setLinkuri] = useState({}) // id → cod afișat după „Trimite acces"

  const load = useCallback(async () => {
    const [m, a, lucrari] = await Promise.all([getMedici(), getAccesMedici(), getLucrari()])
    setMedici(m)
    setAcces(a)
    setNumePeComenzi([...new Set(lucrari.map((l) => (l.medic || '').trim()).filter(Boolean))])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Medicii scriși pe comenzi, dar absenți din listă — comenzile lor nu apar
  // în pagina niciunui medic (legătura se face după nume).
  const faraPereche = useMemo(() => {
    if (!medici) return []
    const nume = new Set(medici.map((m) => m.nume.trim().toLowerCase()))
    return numePeComenzi.filter((n) => !nume.has(n.toLowerCase())).sort((a, b) => a.localeCompare(b, 'ro'))
  }, [medici, numePeComenzi])

  const stareMedic = (id) => {
    const p = acces.get(id)
    return p ? (p.activ ? 'activ' : 'dezactivat') : 'fara'
  }

  const valoare = (m, camp) => ciorne[m.id]?.[camp] ?? m[camp] ?? ''

  const seteazaCiorna = (id, camp, v) => setCiorne((prev) => ({ ...prev, [id]: { ...prev[id], [camp]: v } }))

  const salveazaCamp = async (m, camp) => {
    const nou = (ciorne[m.id]?.[camp] ?? m[camp] ?? '').trim()
    if (nou === (m[camp] || '')) return
    try {
      const actualizat = await updateMedic(m.id, { [camp]: nou })
      setMedici((prev) => prev.map((x) => (x.id === m.id ? actualizat : x)))
      setMesaje((prev) => ({ ...prev, [m.id]: null }))
    } catch (err) {
      setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'eroare', text: err.message } }))
    }
  }

  const ruleaza = async (m, actiune) => {
    if (actiune === 'sterge') {
      const ok = await confirm(
        `Ștergi accesul medicului ${m.nume}? Contul lui se șterge definitiv; notele rămân pe comenzi. Îi poți trimite oricând un acces nou.`,
        { title: 'Ștergi accesul?', confirmLabel: 'Șterge accesul', danger: true }
      )
      if (!ok) return
    }
    if (actiune === 'link_nou') {
      const ok = await confirm(`Linkul trimis deja medicului ${m.nume} nu va mai funcționa. Continui?`, {
        title: 'Generezi un link nou?',
        confirmLabel: 'Link nou',
      })
      if (!ok) return
    }
    setOcupat(m.id)
    setMesaje((prev) => ({ ...prev, [m.id]: null }))
    try {
      const r = await accesMedic(m.id, actiune)
      if (r.cod) setLinkuri((prev) => ({ ...prev, [m.id]: r.cod }))
      if (actiune === 'sterge' || actiune === 'dezactiveaza') setLinkuri((prev) => ({ ...prev, [m.id]: null }))
      const text = {
        trimite: r.creat ? `Acces creat pentru ${r.email}.` : `Acces activ pentru ${r.email}.`,
        link_nou: 'Link nou generat.',
        dezactiveaza: 'Acces dezactivat — medicul nu mai vede nimic.',
        sterge: 'Acces șters.',
      }[actiune]
      setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'ok', text } }))
      setAcces(await getAccesMedici())
    } catch (err) {
      setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'eroare', text: err.message } }))
    } finally {
      setOcupat(null)
    }
  }

  const copiaza = async (m, cod) => {
    try {
      await navigator.clipboard.writeText(linkAccesMedic(cod))
      setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'ok', text: 'Link copiat.' } }))
    } catch {
      setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'eroare', text: 'Linkul nu s-a putut copia.' } }))
    }
  }

  const trimiteWhatsApp = (m, cod) => {
    const r = trimiteLinkAccesMedic({ medic: m, cod })
    if (!r.ok) setMesaje((prev) => ({ ...prev, [m.id]: { tip: 'eroare', text: r.motiv } }))
  }

  const adaugaInLista = async (nume) => {
    await addConfigValue('medici', nume)
    await load()
  }

  return (
    <div className="card medici-card">
      <div className="medici-header">
        <h3>Medici</h3>
        <p>
          Emailul și telefonul fiecărui medic, plus accesul la pagina lui, unde vede comenzile active și notele trimise
          lui. Medicul intră fără parolă, cu un cod primit pe email.
        </p>
      </div>

      {faraPereche.length > 0 && (
        <div className="medici-avertisment" role="status">
          <p>
            Medici scriși pe comenzi, dar care nu sunt în listă — comenzile lor nu vor apărea în pagina niciunui medic.
            Adaugă-i în listă sau corectează numele din fișa comenzii.
          </p>
          <ul>
            {faraPereche.map((n) => (
              <li key={n}>
                <span>{n}</span>
                <button type="button" className="btn btn-ghost medici-mic-btn" onClick={() => adaugaInLista(n)}>
                  Adaugă în listă
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {medici === null ? (
        <p className="medici-gol">Se încarcă…</p>
      ) : medici.length === 0 ? (
        <p className="medici-gol">Niciun medic încă — se adaugă din formularul de comandă.</p>
      ) : (
        <ul className="medici-lista">
          {medici.map((m) => {
            const stare = stareMedic(m.id)
            const cod = linkuri[m.id] || acces.get(m.id)?.cod_acces
            const mesaj = mesaje[m.id]
            const ruleazaAcum = ocupat === m.id
            return (
              <li key={m.id} className="medici-rand">
                <div className="medici-rand-antet">
                  <span className="medici-nume">{m.nume}</span>
                  <span className={`badge ${STARE[stare].badge}`}>{STARE[stare].label}</span>
                </div>
                <div className="medici-campuri">
                  <div>
                    <label className="field-label" htmlFor={`medic-email-${m.id}`}>Email</label>
                    <input
                      id={`medic-email-${m.id}`}
                      type="email"
                      className="text-input"
                      value={valoare(m, 'email')}
                      onChange={(e) => seteazaCiorna(m.id, 'email', e.target.value)}
                      onBlur={() => salveazaCamp(m, 'email')}
                      placeholder="email@clinica.ro"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`medic-telefon-${m.id}`}>Telefon (WhatsApp)</label>
                    <input
                      id={`medic-telefon-${m.id}`}
                      type="tel"
                      className="text-input"
                      value={valoare(m, 'telefon')}
                      onChange={(e) => seteazaCiorna(m.id, 'telefon', e.target.value)}
                      onBlur={() => salveazaCamp(m, 'telefon')}
                      placeholder="07xx xxx xxx"
                    />
                  </div>
                </div>
                <div className="medici-actiuni">
                  {stare !== 'activ' && (
                    <button
                      type="button"
                      className="btn btn-primary medici-mic-btn"
                      onClick={() => ruleaza(m, 'trimite')}
                      disabled={ruleazaAcum || !m.email}
                      title={m.email ? undefined : 'Completează mai întâi emailul'}
                    >
                      {stare === 'dezactivat' ? 'Reactivează accesul' : 'Trimite acces'}
                    </button>
                  )}
                  {stare === 'activ' && cod && (
                    <>
                      <button type="button" className="btn btn-secondary medici-mic-btn" onClick={() => copiaza(m, cod)}>
                        Copiază linkul
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary medici-mic-btn"
                        onClick={() => trimiteWhatsApp(m, cod)}
                        disabled={!m.telefon}
                        title={m.telefon ? undefined : 'Completează telefonul'}
                      >
                        Trimite linkul pe WhatsApp
                      </button>
                      <button type="button" className="btn btn-ghost medici-mic-btn" onClick={() => ruleaza(m, 'link_nou')} disabled={ruleazaAcum}>
                        Link nou
                      </button>
                      <button type="button" className="btn btn-ghost medici-mic-btn" onClick={() => ruleaza(m, 'dezactiveaza')} disabled={ruleazaAcum}>
                        Dezactivează
                      </button>
                    </>
                  )}
                  {stare !== 'fara' && (
                    <button
                      type="button"
                      className="btn btn-outline-danger medici-mic-btn"
                      onClick={() => ruleaza(m, 'sterge')}
                      disabled={ruleazaAcum}
                    >
                      Șterge accesul
                    </button>
                  )}
                </div>
                {stare === 'activ' && cod && <p className="medici-link">{linkAccesMedic(cod)}</p>}
                {ruleazaAcum && <p className="medici-mesaj">Se procesează…</p>}
                {mesaj && <p className={`medici-mesaj ${mesaj.tip === 'eroare' ? 'medici-mesaj-eroare' : ''}`}>{mesaj.text}</p>}
              </li>
            )
          })}
        </ul>
      )}
      {confirmDialog}
    </div>
  )
}
