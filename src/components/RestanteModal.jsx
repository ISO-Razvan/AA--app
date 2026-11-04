import { useMemo, useState } from 'react'
import DatePicker from './DatePicker.jsx'
import DeschideFisaButton from './DeschideFisaButton.jsx'
import { adaosuriPentruEtapa, totalAdaosuri } from '../utils/adaosuriDesign'
import {
  candidatiEtapa,
  esteEtapaModel,
  lunaSalariu,
  problemeData,
  problemeInchidere,
  randuriDeInchis,
  tehnicianPresetat,
} from '../utils/etapeNeplanificate'
import { formatSuma } from './SalariiPage.jsx'
import './modal-base.css'
import './RestanteModal.css'

function formatData(iso) {
  if (!iso) return '—'
  const [a, l, z] = iso.split('-')
  return `${z}.${l}.${a}`
}

const zileText = (zile) => `${zile} ${zile === 1 ? 'zi' : 'zile'}`

// Comisionul etapei din instantaneul lucrării (îl vede doar patronul).
const comisionEtapa = (lucrare, etapaId) =>
  Number((lucrare.comisioane || []).find((c) => c.etapa_id === etapaId)?.suma) || 0

// Lucrările restante: termenul de predare a trecut (lucrarea e deja în clinică),
// dar au etape neprogramate și nebifate. Panoul le listează, cele mai vechi
// primele; „Închide" deschide închiderea unei lucrări, în 2 pași:
//   1. „Cine a făcut-o?" — tehnicianul fiecărei etape nebifate;
//   2. „Când?" — o singură dată (implicit termenul de predare), cu luna salariului.
// Se închid toate etapele nebifate ale lucrării sau niciuna.
// `onInchide(randuri, data)` face scrierea; după succes revine la listă.
export default function RestanteModal({ intrari, tehnicieni, esteSumeVizibile, astazi, onInchide, onOpenLucrare, onClose }) {
  const [lucrareId, setLucrareId] = useState(null)
  const intrare = intrari.find((i) => i.lucrare.id === lucrareId) || null

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="rs-modal" role="dialog" aria-modal="true" aria-label="Lucrări restante">
        {intrare ? (
          <InchidereLucrare
            key={intrare.lucrare.id}
            intrare={intrare}
            tehnicieni={tehnicieni}
            esteSumeVizibile={esteSumeVizibile}
            astazi={astazi}
            onInchide={onInchide}
            onOpenLucrare={onOpenLucrare}
            onInapoi={() => setLucrareId(null)}
            onClose={onClose}
          />
        ) : (
          <ListaRestante intrari={intrari} onAlege={setLucrareId} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

function ListaRestante({ intrari, onAlege, onClose }) {
  return (
    <>
      <header className="rs-antet">
        <div>
          <h2>Lucrări restante</h2>
          <p className="rs-pas">{intrari.length} {intrari.length === 1 ? 'lucrare' : 'lucrări'} · cele mai vechi primele</p>
        </div>
        <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">✕</button>
      </header>

      <div className="rs-corp">
        <p className="rs-intro">
          Termenul de predare a trecut, deci lucrările sunt deja în clinică, dar au etape neprogramate și nebifate. Nu se mai planifică:
          alege o lucrare și închide-o cu tehnicianul și data reală.
        </p>
        <ul className="rs-lista">
          {intrari.map(({ lucrare, zile }) => (
            <li key={lucrare.id}>
              <button type="button" className="rs-rand" onClick={() => onAlege(lucrare.id)}>
                <span className="rs-rand-nr">{lucrare.nr_inregistrare}</span>
                <span className="rs-rand-info">
                  <span className="rs-rand-tip">{lucrare.tip_lucrare || '—'}</span>
                  <span className="rs-rand-clinica">{lucrare.clinica || '—'}</span>
                </span>
                <span className="rs-rand-termen">
                  <span>Termen {formatData(lucrare.termen_predare)}</span>
                  <span className="rs-intarziere">depășit cu {zileText(zile)}</span>
                </span>
                <span className="rs-rand-sageata" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

function InchidereLucrare({ intrare, tehnicieni, esteSumeVizibile, astazi, onInchide, onOpenLucrare, onInapoi, onClose }) {
  const { lucrare, zile, etape } = intrare
  const [pas, setPas] = useState(1)
  const [tehnicianPe, setTehnicianPe] = useState(() =>
    Object.fromEntries(etape.filter(({ etapa }) => !esteEtapaModel(etapa)).map(({ etapa, rand }) => [etapa.id, tehnicianPresetat(etapa, rand, tehnicieni)]))
  )
  const [data, setData] = useState(lucrare.termen_predare && lucrare.termen_predare <= astazi ? lucrare.termen_predare : astazi)
  const [acelasi, setAcelasi] = useState('')
  const [salvare, setSalvare] = useState(false)
  const [eroare, setEroare] = useState('')

  const probleme1 = problemeInchidere({ intrare, tehnicianPe })
  const probleme2 = problemeData({ intrare, data, astazi })

  const seteazaTehnician = (etapaId, id) => setTehnicianPe((prev) => ({ ...prev, [etapaId]: id }))

  // Scurtătura: același tehnician pe etapele la care poate lucra (mai puțin Model). La o
  // etapă care are tehnicieni cu rolul ei și nu-l include pe cel ales (ex. Livrare, a lui
  // ADM), rămâne tehnicianul de dinainte — altfel etapa ar fi trecută pe cineva care nu o face.
  const aplicaLaToate = (id) => {
    setAcelasi(id)
    if (!id) return
    setTehnicianPe((prev) =>
      Object.fromEntries(
        etape
          .filter(({ etapa }) => !esteEtapaModel(etapa))
          .map(({ etapa, rand }) => [etapa.id, candidatiEtapa(etapa, rand, tehnicieni).some((t) => t.id === id) ? id : prev[etapa.id] || ''])
      )
    )
  }

  // Impactul pe salarii, per tehnician (doar patronul — coordonatorul nu vede sume).
  const impact = useMemo(() => {
    if (!esteSumeVizibile) return []
    const map = new Map()
    for (const { etapa } of etape) {
      const id = tehnicianPe[etapa.id]
      if (!id) continue
      const suma = comisionEtapa(lucrare, etapa.id) + totalAdaosuri(adaosuriPentruEtapa(lucrare, etapa))
      const curent = map.get(id) || { nume: tehnicieni.find((t) => t.id === id)?.nume || '—', total: 0 }
      curent.total += suma
      map.set(id, curent)
    }
    return [...map.values()].sort((x, y) => x.nume.localeCompare(y.nume, 'ro'))
  }, [esteSumeVizibile, etape, tehnicianPe, tehnicieni, lucrare])

  const lunaCurenta = data && data.slice(0, 7) === astazi.slice(0, 7)

  const confirma = async () => {
    if (probleme1.length > 0 || probleme2.length > 0) return
    setSalvare(true)
    setEroare('')
    try {
      await onInchide(randuriDeInchis({ intrare, tehnicianPe, data }), data)
      onInapoi()
    } catch (err) {
      setEroare(err.message)
      setSalvare(false)
    }
  }

  return (
    <>
      <header className="rs-antet">
        <div>
          <h2>{pas === 1 ? 'Cine a făcut-o?' : 'Când?'}</h2>
          <p className="rs-pas">Pasul {pas} din 2 · {lucrare.nr_inregistrare}</p>
        </div>
        <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide" disabled={salvare}>✕</button>
      </header>

      <div className="rs-corp">
        <div className="rs-lucrare">
          <div className="rs-lucrare-info">
            <span className="rezumat-pacient">{lucrare.pacient || '—'}</span>
            <span className="rezumat-medic">{lucrare.medic || '—'}{lucrare.clinica ? ` · ${lucrare.clinica}` : ''}</span>
            <span className="rezumat-tip">{lucrare.tip_lucrare}</span>
          </div>
          <div className="rs-lucrare-dreapta">
            <span className="rs-intarziere rs-intarziere-pastila">
              Termen {formatData(lucrare.termen_predare)} · depășit cu {zileText(zile)}
            </span>
            <DeschideFisaButton onClick={() => onOpenLucrare(lucrare)} />
          </div>
        </div>

        {pas === 1 ? (
          <>
            <p className="rs-intro">Alege tehnicianul pentru fiecare etapă nebifată. Se închid toate etapele odată.</p>

            <label className="rs-acelasi">
              <span className="field-label">Același tehnician pentru toate etapele</span>
              <span className="rs-nota">Se aplică etapelor la care poate lucra; celelalte (ex. Livrare) rămân cum sunt.</span>
              <select className="text-input rs-acelasi-select" value={acelasi} onChange={(e) => aplicaLaToate(e.target.value)}>
                <option value="">— alege —</option>
                {tehnicieni.map((t) => (
                  <option key={t.id} value={t.id}>{t.nume}</option>
                ))}
              </select>
            </label>

            <ul className="rs-etape">
              {etape.map(({ etapa, rand }) => {
                const model = esteEtapaModel(etapa)
                const planificata = rand?.tehnician_id && rand?.data_planificata
                return (
                  <li key={etapa.id} className="rs-etapa">
                    <span className="rs-etapa-nume">{etapa.nume}</span>
                    <span className="rs-etapa-stare">
                      {model ? 'se bifează fără tehnician' : planificata ? `planificată ${formatData(rand.data_planificata)}` : 'neplanificată'}
                    </span>
                    {!model && (
                      <select
                        className="text-input rs-tehnician"
                        value={tehnicianPe[etapa.id] || ''}
                        onChange={(e) => { setAcelasi(''); seteazaTehnician(etapa.id, e.target.value) }}
                        aria-label={`Cine a făcut ${etapa.nume}`}
                      >
                        <option value="">Alege tehnicianul…</option>
                        {candidatiEtapa(etapa, rand, tehnicieni).map((t) => (
                          <option key={t.id} value={t.id}>{t.nume}</option>
                        ))}
                      </select>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <>
            <div className="rs-data">
              <span className="field-label">Data la care s-au făcut etapele *</span>
              <DatePicker value={data} onChange={setData} />
              <p className="rs-nota">Implicit, termenul de predare. Nu poate fi în viitor.</p>
            </div>

            {probleme2.length === 0 && (
              <p className="rs-luna">
                Comisionul intră în salariile din <strong>{lunaSalariu(data)}</strong>
                {lunaCurenta ? '.' : ', nu în cele ale lunii curente.'}
              </p>
            )}

            <ul className="rs-rezumat">
              {etape.map(({ etapa }) => (
                <li key={etapa.id}>
                  <span className="rs-rezumat-etapa">{etapa.nume}</span>
                  <span className="rs-rezumat-teh">
                    {esteEtapaModel(etapa) ? 'fără tehnician' : tehnicieni.find((t) => t.id === tehnicianPe[etapa.id])?.nume || '—'}
                  </span>
                </li>
              ))}
            </ul>

            {esteSumeVizibile && impact.length > 0 && (
              <section className="rs-caseta">
                <h3>Impact pe salarii — {lunaSalariu(data || astazi)}</h3>
                <ul>
                  {impact.map((r) => (
                    <li key={r.nume}>
                      <span>{r.nume}</span>
                      <strong>+ {formatSuma(r.total)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!esteSumeVizibile && <p className="rs-nota">Sumele din salarii le vede doar patronul.</p>}
            {eroare && <p className="rs-eroare">{eroare}</p>}
          </>
        )}
      </div>

      <footer className="rs-subsol">
        <p className={`rs-subsol-mesaj ${(pas === 1 ? probleme1 : probleme2).length > 0 ? 'rs-subsol-mesaj-problema' : ''}`}>
          {pas === 1
            ? probleme1.length > 0
              ? `${probleme1[0]}${probleme1.length > 1 ? ` (+${probleme1.length - 1})` : ''}`
              : 'O închidere se anulează doar debifând, etapă cu etapă, din fișa lucrării.'
            : probleme2.length > 0
              ? probleme2[0]
              : 'O închidere se anulează doar debifând, etapă cu etapă, din fișa lucrării.'}
        </p>
        <div className="rs-subsol-butoane">
          {pas === 1 ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={onInapoi}>Înapoi la listă</button>
              <button type="button" className="btn btn-primary" onClick={() => setPas(2)} disabled={probleme1.length > 0}>Continuă</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setPas(1)} disabled={salvare}>Înapoi</button>
              <button type="button" className="btn btn-primary" onClick={confirma} disabled={salvare || probleme2.length > 0}>
                {salvare ? 'Se închid…' : 'Confirmă închiderea'}
              </button>
            </>
          )}
        </div>
      </footer>
    </>
  )
}
