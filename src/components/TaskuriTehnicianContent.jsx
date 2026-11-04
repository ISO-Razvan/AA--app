import { useEffect, useMemo, useState } from 'react'
import { getLucrari, getEtapeProductie, getProductieTehnician, setFinalizareEtapa, setTrimisLaValidare } from '../services/dataService'
import { azi } from '../utils/date'
import { esteEtapaModel, esteEtapaValidare, esteEtapaDesignNume } from '../utils/etapaProductie'
import { zileDepasite } from '../utils/etapeNeplanificate'
import { subscribeToTable } from '../services/realtime'
import CalendarLunar from './CalendarLunar.jsx'
import FacuteSaptamana from './FacuteSaptamana.jsx'
import PrintChecklist from './PrintChecklist.jsx'
import DeschideFisaButton from './DeschideFisaButton.jsx'
import EticheaPrintare from './EticheaPrintare.jsx'
import './TaskuriTehnicianContent.css'

function formatZiLunga(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// „de azi" / „de 1 zi" / „de 3 zile" — de când a fost trimisă lucrarea la validare.
function textVechime(timestamp) {
  const d = new Date(timestamp)
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const zile = Math.max(0, zileDepasite(local, azi()))
  if (zile === 0) return 'trimisă azi'
  return `trimisă de ${zile} ${zile === 1 ? 'zi' : 'zile'}`
}

// Conținutul comun al vederii „sarcinile unui tehnician, pe zi" — calendar
// lunar + lista zilei + bifare finalizat + print checklist. Reutilizat atât
// în modalul de manager (TaskuriTehnicianModal), cât și în pagina
// „Task-urile mele" a tehnicianului logat (TaskurileMelePage) — fiecare
// wrapper își decide doar chrome-ul (modal vs. pagină) și ce înseamnă
// „deschide lucrarea" (`onOpenLucrare`).
export default function TaskuriTehnicianContent({ tehnician, initialDate, onOpenLucrare }) {
  const [data, setData] = useState(initialDate || azi())
  const [alocari, setAlocari] = useState([])
  const [lucrari, setLucrari] = useState([])
  // Cu lucrările arhivate (și rândurile lor): istoricul „Făcute în săptămâna asta" nu dispare la arhivare.
  const [lucrariToate, setLucrariToate] = useState([])
  const [alocariToate, setAlocariToate] = useState([])
  const [etape, setEtape] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPrint, setShowPrint] = useState(false)
  // Finalizatele sunt ascunse implicit din lista zilei (contor „X/Y finalizate").
  const [arataFinalizate, setArataFinalizate] = useState(false)
  const [ocupat, setOcupat] = useState(null)
  const [eroare, setEroare] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [a, l, e] = await Promise.all([
        getProductieTehnician(tehnician.id),
        getLucrari(),
        getEtapeProductie(),
      ])
      // O lucrare arhivată nu mai apare în calendar/listă și nu mai poate
      // primi etape noi — filtrăm atât lucrările, cât și alocările lor.
      const lucrariActive = l.filter((x) => !x.arhivat)
      const idActive = new Set(lucrariActive.map((x) => x.id))
      setAlocari(a.filter((al) => idActive.has(al.lucrare_id)))
      setAlocariToate(a)
      setLucrari(lucrariActive)
      setLucrariToate(l)
      setEtape(e)
      setLoading(false)
    }
    load()
  }, [tehnician.id])

  // Timp real: orice bifare (de aici, din Kanban, din fișă sau de pe alt dispozitiv) se
  // vede singură, inclusiv în „Făcute în săptămâna asta".
  useEffect(() => {
    let montat = true
    const unsubscribe = subscribeToTable('productie_lucrare', async () => {
      try {
        const [a, l] = await Promise.all([getProductieTehnician(tehnician.id), getLucrari()])
        if (!montat) return
        const lucrariActive = l.filter((x) => !x.arhivat)
        const idActive = new Set(lucrariActive.map((x) => x.id))
        setAlocariToate(a)
        setAlocari(a.filter((al) => idActive.has(al.lucrare_id)))
        setLucrari(lucrariActive)
        setLucrariToate(l)
      } catch {
        // rămâne starea de dinainte
      }
    })
    return () => {
      montat = false
      unsubscribe()
    }
  }, [tehnician.id])

  // Validare (designer): doar dacă există etapa marcată „validare" în Setup. Designul se
  // finalizează din „Finalizat" (direct sau din lista de validare), nu din bifă; o lucrare
  // „trimisă la validare" iese din lista zilei și apare în „Trimise la validare".
  const etapaDesign = etape.find(esteEtapaDesignNume) || null
  const validareActiva = etape.some(esteEtapaValidare) && !!etapaDesign
  const esteDesign = (alocare) => validareActiva && alocare.etapa_id === etapaDesign.id
  const esteTrimisa = (alocare) => esteDesign(alocare) && !!alocare.trimis_la_validare_la && !alocare.finalizat
  const alocariVizibile = alocari.filter((a) => !esteTrimisa(a))

  const countsByDay = useMemo(() => {
    const map = {}
    // Indicatorul zilei = câte au RĂMAS de făcut (finalizatele nu se mai numără aici).
    for (const a of alocariVizibile) {
      if (!a.data_planificata || a.finalizat) continue
      map[a.data_planificata] = (map[a.data_planificata] || 0) + 1
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alocari, etape])

  // Toate sarcinile zilei (inclusiv finalizate) — pentru contor și pentru Printează;
  // lista afișată le ascunde pe cele finalizate, în afară de cazul când se cer.
  const sarciniZiToate = alocariVizibile
    .filter((a) => a.data_planificata === data)
    .map((a) => ({
      alocare: a,
      lucrare: lucrari.find((l) => l.id === a.lucrare_id),
      etapa: etape.find((e) => e.id === a.etapa_id),
    }))
    .filter((s) => s.lucrare)
  const nrFinalizateZi = sarciniZiToate.filter((s) => s.alocare.finalizat).length
  const sarciniZi = arataFinalizate ? sarciniZiToate : sarciniZiToate.filter((s) => !s.alocare.finalizat)

  // Un tehnician cu mai multe roluri (ex. Design și Frezare) are câte o secțiune pe
  // etapă, fiecare cu propriile sarcini din ziua aleasă. Cu un singur rol (sau
  // niciunul) lista rămâne simplă, ca înainte.
  const roluri = tehnician.roluri || []
  const sectiuni = etape.filter(
    (e) => (!esteEtapaModel(e) && roluri.includes(e.id)) || sarciniZiToate.some((s) => s.etapa?.id === e.id && !s.alocare.finalizat)
  )
  const peSectiuni = sectiuni.length > 1

  const renderSarcina = ({ alocare, lucrare, etapa }) => (
      <li key={alocare.id} className={`taskuri-sarcina-item ${alocare.finalizat ? 'taskuri-sarcina-finalizata' : ''} ${esteDesign(alocare) && !alocare.finalizat ? 'taskuri-sarcina-design' : ''}`}>
        {esteDesign(alocare) && !alocare.finalizat ? null : (
          <label className="taskuri-checkbox" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={!!alocare.finalizat}
              onChange={() => handleToggleFinalizat(alocare)}
              aria-label={alocare.finalizat ? 'Marchează etapa ca nefinalizată' : 'Marchează etapa ca finalizată'}
            />
          </label>
        )}
        <div className="taskuri-sarcina-caseta">
          <button type="button" className="taskuri-sarcina-row" onClick={() => onOpenLucrare(lucrare)}>
            <div className="taskuri-sarcina-top">
              <span className="taskuri-sarcina-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
              <div className="taskuri-sarcina-top-badges">
                {etapa && <span className="badge badge-purple">{etapa.nume}</span>}
                {alocare.finalizat && <span className="badge badge-success">Finalizat</span>}
              </div>
            </div>
            <p className="taskuri-sarcina-line rezumat-medic">{lucrare.medic || '—'}</p>
            <p className="taskuri-sarcina-line rezumat-tip">{lucrare.tip_lucrare}</p>
            <EticheaPrintare tip={lucrare.tip_lucrare} />
            <p className="taskuri-sarcina-line taskuri-sarcina-meta">
              <span className="taskuri-sarcina-nr">{lucrare.nr_inregistrare}</span>
              {lucrare.clinica && ` · ${lucrare.clinica}`}
            </p>
          </button>
          <DeschideFisaButton className="taskuri-sarcina-fisa" onClick={() => onOpenLucrare(lucrare)} />
        </div>
        {esteDesign(alocare) && !alocare.finalizat && (
          <div className="taskuri-design-actiuni">
            <button type="button" className="btn btn-secondary taskuri-btn-validare" onClick={() => handleTrimite(alocare, true)} disabled={ocupat === alocare.id}>
              Validare
            </button>
            <button type="button" className="btn btn-primary taskuri-btn-finalizat" onClick={() => handleFinalizeazaDesign(alocare)} disabled={ocupat === alocare.id}>
              Finalizat
            </button>
          </div>
        )}
      </li>
  )

  // Lucrările trimise la validare (toate zilele), cele mai vechi primele.
  const trimise = validareActiva
    ? alocari
        .filter(esteTrimisa)
        .map((a) => ({ alocare: a, lucrare: lucrari.find((l) => l.id === a.lucrare_id) }))
        .filter((x) => x.lucrare)
        .sort((x, y) => String(x.alocare.trimis_la_validare_la).localeCompare(String(y.alocare.trimis_la_validare_la)))
    : []
  // Lista „Trimise la validare" apare la cine lucrează la Design (sau are deja lucrări trimise).
  const arataValidare = validareActiva && (roluri.includes(etapaDesign.id) || trimise.length > 0)

  const actualizeaza = (updated) => {
    setAlocari((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    setAlocariToate((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  const ruleaza = async (alocare, actiune) => {
    if (ocupat) return
    setOcupat(alocare.id)
    setEroare('')
    try {
      actualizeaza(await actiune())
    } catch (err) {
      setEroare(err.message || 'Nu s-a putut salva.')
    } finally {
      setOcupat(null)
    }
  }

  // „Validare": trimite lucrarea la validare. Designul NU se finalizează (nu se plătește acum).
  const handleTrimite = (alocare, trimis) => ruleaza(alocare, () => setTrimisLaValidare(alocare.lucrare_id, alocare.etapa_id, trimis))

  // „Finalizat" pe Design: finalizează designul (data = azi); baza de date marchează și
  // Validare „sărită" (fără tehnician, fără comision), iar lucrarea trece la Frezare.
  const handleFinalizeazaDesign = (alocare) => ruleaza(alocare, () => setFinalizareEtapa(alocare.lucrare_id, alocare.etapa_id, true))

  const handleToggleFinalizat = async (alocare) => {
    const updated = await setFinalizareEtapa(alocare.lucrare_id, alocare.etapa_id, !alocare.finalizat)
    actualizeaza(updated)
  }

  return (
    <div className="taskuri-continut">
      <div className="taskuri-continut-top">
        <CalendarLunar value={data} onChange={setData} countsByDay={countsByDay} />
        <div className="taskuri-continut-day-row">
          <span className="taskuri-day-label">
            {formatZiLunga(data)}
            {sarciniZiToate.length > 0 && (
              <span className="taskuri-zi-contor-tehnician">
                {nrFinalizateZi}/{sarciniZiToate.length} finalizate
              </span>
            )}
          </span>
          <div className="taskuri-day-row-actiuni">
            {nrFinalizateZi > 0 && (
              <button
                type="button"
                className={`btn ${arataFinalizate ? 'btn-primary' : 'btn-secondary'}`}
                aria-pressed={arataFinalizate}
                onClick={() => setArataFinalizate((v) => !v)}
              >
                Arată și finalizatele
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setShowPrint(true)}>
              Printează
            </button>
          </div>
        </div>
      </div>

      {eroare && <p className="taskuri-eroare" role="alert">{eroare}</p>}

      <div className={`taskuri-continut-body ${arataValidare ? 'taskuri-continut-cu-validare' : ''}`}>
        <div className="taskuri-continut-principal">
        {loading ? (
          <p className="taskuri-loading">Se încarcă…</p>
        ) : sarciniZi.length === 0 && !peSectiuni ? (
          <p className="taskuri-nicio-sarcina">
            {sarciniZiToate.length > 0
              ? `Toate cele ${sarciniZiToate.length} lucrări ale zilei sunt finalizate.`
              : `Nicio sarcină programată pentru ${formatZiLunga(data).toLowerCase()}.`}
          </p>
        ) : (
          peSectiuni ? (
            <div className="taskuri-sectiuni-zi">
              {sectiuni.map((etapaSectiune) => {
                const sarciniSectiune = sarciniZi.filter((x) => x.etapa?.id === etapaSectiune.id)
                return (
                  <section key={etapaSectiune.id} className="taskuri-sectiune-zi" aria-label={`Etapa ${etapaSectiune.nume}`}>
                    <h3 className="taskuri-sectiune-zi-titlu">
                      {etapaSectiune.nume}
                      <span className="taskuri-sectiune-zi-nr">{sarciniSectiune.length}</span>
                    </h3>
                    {sarciniSectiune.length === 0 ? (
                      <p className="taskuri-nicio-sarcina">Nicio sarcină la {etapaSectiune.nume} în această zi.</p>
                    ) : (
                      <ul className="taskuri-sarcini-list">{sarciniSectiune.map(renderSarcina)}</ul>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <ul className="taskuri-sarcini-list">{sarciniZi.map(renderSarcina)}</ul>
          )
        )}
        </div>

        {arataValidare && (
          <aside className="taskuri-validare" aria-label="Trimise la validare">
            <h3 className="taskuri-validare-titlu">
              Trimise la validare
              <span className="taskuri-sectiune-zi-nr">{trimise.length}</span>
            </h3>
            {trimise.length === 0 ? (
              <p className="taskuri-nicio-sarcina taskuri-validare-gol">Nicio lucrare trimisă la validare.</p>
            ) : (
              <ul className="taskuri-sarcini-list">
                {trimise.map(({ alocare, lucrare }) => (
                  <li key={alocare.id} className="taskuri-validare-item">
                    <button type="button" className="taskuri-validare-info" onClick={() => onOpenLucrare(lucrare)}>
                      <span className="taskuri-sarcina-nr">{lucrare.nr_inregistrare}</span>
                      <span className="taskuri-sarcina-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                      <span className="taskuri-sarcina-line rezumat-tip">{lucrare.tip_lucrare}</span>
                      <span className="taskuri-validare-vechime">{textVechime(alocare.trimis_la_validare_la)}</span>
                    </button>
                    <div className="taskuri-validare-actiuni">
                      <button
                        type="button"
                        className="btn btn-primary taskuri-btn-finalizat"
                        onClick={() => handleFinalizeazaDesign(alocare)}
                        disabled={ocupat === alocare.id}
                      >
                        Finalizat
                      </button>
                      <button
                        type="button"
                        className="taskuri-validare-anuleaza"
                        onClick={() => handleTrimite(alocare, false)}
                        disabled={ocupat === alocare.id}
                      >
                        Anulează trimiterea
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      <FacuteSaptamana
        tehnicianId={tehnician.id}
        alocari={alocariToate}
        lucrari={lucrariToate}
        etape={etape}
        astazi={azi()}
        onOpenLucrare={onOpenLucrare}
      />

      {showPrint && (
        <PrintChecklist
          tehnician={tehnician}
          dataLabel={formatZiLunga(data)}
          sarcini={sarciniZiToate}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
