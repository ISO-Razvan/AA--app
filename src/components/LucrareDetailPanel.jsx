import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { updateLucrare, deleteLucrare, getConfigList, addConfigValue, getEtapeProductie, getProductieLucrare } from '../services/dataService'
import { MODEL_OPTIONS } from '../data/configDefaults'
import { calculeazaDinti, dinDintiSalvati, toggleLinkPair, toggleToothSelection } from '../utils/dintiGrupuri'
import { statusDinRanduri } from '../utils/statusLucrare'
import DentalChart from './DentalChart.jsx'
import SearchableSelect from './SearchableSelect.jsx'
import DatePicker from './DatePicker.jsx'
import TimePicker from './TimePicker.jsx'
import ProductieTimeline from './ProductieTimeline.jsx'
import GaleriePoze from './GaleriePoze.jsx'
import './LucrareDetailPanel.css'

function formatDataOra(dataStr, oraStr) {
  if (!dataStr) return ''
  const [an, luna, zi] = dataStr.split('-')
  const dataFmt = `${zi}.${luna}.${an}`
  return oraStr ? `${dataFmt}, ${oraStr}` : dataFmt
}

const TABS = [
  { id: 'detalii', label: 'Detalii comandă' },
  { id: 'productie', label: 'Producție' },
  { id: 'galerie', label: 'Galerie' },
  { id: 'chat', label: 'Chat' },
]

export default function LucrareDetailPanel({ lucrare, onClose, onUpdated }) {
  const [tab, setTab] = useState('detalii')
  const initial = dinDintiSalvati(lucrare.dinti)

  const [selectateNumere, setSelectateNumere] = useState(initial.selectateNumere)
  const [linkPairs, setLinkPairs] = useState(initial.linkPairs)
  const [nrElemente, setNrElemente] = useState(initial.selectateNumere.length)
  const [clinica, setClinica] = useState(lucrare.clinica || '')
  const [medic, setMedic] = useState(lucrare.medic || '')
  const [pacient, setPacient] = useState(lucrare.pacient || '')
  const [tipLucrare, setTipLucrare] = useState(lucrare.tip_lucrare || '')
  const [culoare, setCuloare] = useState(lucrare.culoare || '')
  const [implant, setImplant] = useState(lucrare.implant || false)
  const [tryIn, setTryIn] = useState(lucrare.try_in || false)
  const [model, setModel] = useState(lucrare.model || '')
  const [dataIntrare, setDataIntrare] = useState(lucrare.data_intrare || '')
  const [termenPredare, setTermenPredare] = useState(lucrare.termen_predare || '')
  const [oraProgramare, setOraProgramare] = useState(lucrare.ora_programare || '')
  const [nextDate, setNextDate] = useState(lucrare.next_date || '')
  const [nota, setNota] = useState(lucrare.nota || '')

  const [tipuriOptions, setTipuriOptions] = useState([])
  const [culoriOptions, setCuloriOptions] = useState([])
  const [mediciOptions, setMediciOptions] = useState([])
  const [cliniciOptions, setCliniciOptions] = useState([])

  const [savedAt, setSavedAt] = useState(null)
  const [statusLucrare, setStatusLucrare] = useState(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    async function loadStatus() {
      const [etape, randuri] = await Promise.all([getEtapeProductie(), getProductieLucrare(lucrare.id)])
      setStatusLucrare(statusDinRanduri(etape.length, randuri))
    }
    loadStatus()
  }, [lucrare.id])

  useEffect(() => {
    async function load() {
      const [tipuri, culori, medici, clinici] = await Promise.all([
        getConfigList('tipuri_lucrare'),
        getConfigList('culori'),
        getConfigList('medici'),
        getConfigList('clinici'),
      ])
      setTipuriOptions(tipuri)
      setCuloriOptions(culori)
      setMediciOptions(medici)
      setCliniciOptions(clinici)
    }
    load()
  }, [])

  const persist = async (patch) => {
    await updateLucrare(lucrare.id, patch)
    setSavedAt(Date.now())
    await onUpdated?.()
  }

  const handleDelete = async () => {
    const ok = window.confirm(
      `Ștergi definitiv lucrarea ${lucrare.nr_inregistrare}${lucrare.pacient ? ` (${lucrare.pacient})` : ''}? Acțiunea nu poate fi anulată.`
    )
    if (!ok) return
    await deleteLucrare(lucrare.id)
    onClose()
    await onUpdated?.()
  }

  const toggleTooth = async (numar) => {
    const next = toggleToothSelection(selectateNumere, linkPairs, numar)
    setSelectateNumere(next.selectateNumere)
    setLinkPairs(next.linkPairs)
    setNrElemente(next.selectateNumere.length)
    await persist({
      dinti: calculeazaDinti(next.selectateNumere, next.linkPairs),
      nr_elemente: next.selectateNumere.length,
    })
  }

  const toggleLink = async (a, b) => {
    const next = toggleLinkPair(linkPairs, a, b)
    setLinkPairs(next)
    await persist({ dinti: calculeazaDinti(selectateNumere, next) })
  }

  const handleAdd = (configTip, setOptions) => async (nume) => {
    const saved = await addConfigValue(configTip, nume)
    setOptions((prev) => (prev.includes(saved) ? prev : [...prev, saved]))
    return saved
  }

  const qrUrl = `${window.location.origin}/comanda/${encodeURIComponent(lucrare.nr_inregistrare)}`

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="detail-panel" role="dialog" aria-modal="true" aria-label={`Detalii lucrare ${lucrare.nr_inregistrare}`}>
        <header className="detail-panel-header">
          <div className="detail-panel-title">
            <div className="detail-panel-title-row">
              <h2>{lucrare.tip_lucrare || 'Lucrare'}</h2>
              {statusLucrare && (
                <span className={`badge ${statusLucrare.badgeClass}`}>{statusLucrare.label}</span>
              )}
            </div>
            <p>{lucrare.nr_inregistrare}</p>
          </div>

          <div className="detail-panel-qr">
            <QRCodeSVG value={qrUrl} size={72} bgColor="transparent" fgColor="#1E2233" />
            <span>{lucrare.nr_inregistrare}</span>
          </div>

          <div className="detail-panel-header-actions">
            <button type="button" className="btn btn-ghost detail-panel-delete" onClick={handleDelete}>
              Șterge lucrarea
            </button>
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
              ✕
            </button>
          </div>
        </header>

        <nav className="detail-panel-tabs" aria-label="Secțiuni lucrare">
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
          {tab === 'detalii' && (
            <div className="detail-tab-detalii">
              <div className="detail-chart-col">
                <DentalChart
                  selectateNumere={selectateNumere}
                  linkPairs={linkPairs}
                  onToggleTooth={toggleTooth}
                  onToggleLink={toggleLink}
                  culoare={culoare}
                  culoriOptions={culoriOptions}
                  onCuloareChange={async (v) => {
                    setCuloare(v)
                    await persist({ culoare: v })
                  }}
                  onAddCuloare={handleAdd('culori', setCuloriOptions)}
                />
                {savedAt && <p className="detail-saved-hint">Salvat automat</p>}
              </div>

              <div className="detail-sections-col">
                <section className="detail-section">
                  <h3 className="detail-section-title">Client</h3>
                  <div className="detail-section-grid">
                    <SearchableSelect
                      label="Clinică"
                      value={clinica}
                      onChange={async (v) => {
                        setClinica(v)
                        await persist({ clinica: v })
                      }}
                      options={cliniciOptions}
                      onAddOption={handleAdd('clinici', setCliniciOptions)}
                      placeholder="Numele clinicii"
                    />
                    <SearchableSelect
                      label="Medic"
                      value={medic}
                      onChange={async (v) => {
                        setMedic(v)
                        await persist({ medic: v })
                      }}
                      options={mediciOptions}
                      onAddOption={handleAdd('medici', setMediciOptions)}
                      placeholder="Numele medicului"
                    />
                    <div>
                      <label className="field-label">Pacient</label>
                      <input
                        type="text"
                        className="text-input"
                        value={pacient}
                        onChange={(e) => setPacient(e.target.value)}
                        onBlur={(e) => persist({ pacient: e.target.value })}
                        placeholder="Nume sau inițiale"
                      />
                    </div>
                  </div>
                </section>

                <section className="detail-section">
                  <h3 className="detail-section-title">Lucrare</h3>
                  <SearchableSelect
                    label="Tip lucrare"
                    required
                    value={tipLucrare}
                    onChange={async (v) => {
                      setTipLucrare(v)
                      await persist({ tip_lucrare: v })
                    }}
                    options={tipuriOptions}
                    onAddOption={handleAdd('tipuri_lucrare', setTipuriOptions)}
                    placeholder="ex. Coroană zirconiu"
                  />
                  <div className="detail-field-row">
                    <div>
                      <span className="field-label">Culoare (VITA)</span>
                      <div className="culoare-readonly">
                        {culoare || <span className="culoare-readonly-empty">Alege din dintele central</span>}
                      </div>
                    </div>
                    <div>
                      <label className="field-label">Nr. elemente</label>
                      <input
                        type="number"
                        min="0"
                        className="text-input"
                        value={nrElemente}
                        onChange={(e) => setNrElemente(e.target.value === '' ? 0 : Number(e.target.value))}
                        onBlur={(e) => persist({ nr_elemente: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="detail-field-row-3">
                    <div>
                      <span className="field-label">Implant</span>
                      <div className="segmented" role="group" aria-label="Implant">
                        <button
                          type="button"
                          className={`segmented-option ${!implant ? 'active' : ''}`}
                          onClick={async () => {
                            setImplant(false)
                            await persist({ implant: false })
                          }}
                        >
                          Nu
                        </button>
                        <button
                          type="button"
                          className={`segmented-option ${implant ? 'active' : ''}`}
                          onClick={async () => {
                            setImplant(true)
                            await persist({ implant: true })
                          }}
                        >
                          Da
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="field-label">Try-in</span>
                      <div className="segmented" role="group" aria-label="Try-in">
                        <button
                          type="button"
                          className={`segmented-option ${!tryIn ? 'active' : ''}`}
                          onClick={async () => {
                            setTryIn(false)
                            await persist({ try_in: false })
                          }}
                        >
                          Nu
                        </button>
                        <button
                          type="button"
                          className={`segmented-option ${tryIn ? 'active' : ''}`}
                          onClick={async () => {
                            setTryIn(true)
                            await persist({ try_in: true })
                          }}
                        >
                          Da
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="field-label">Model</span>
                      <div className="segmented" role="group" aria-label="Model">
                        {MODEL_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`segmented-option ${model === opt ? 'active' : ''}`}
                            onClick={async () => {
                              setModel(opt)
                              await persist({ model: opt })
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="detail-section">
                  <h3 className="detail-section-title">Termene</h3>
                  <div className="detail-field-row-3">
                    <div>
                      <label className="field-label">Data intrare</label>
                      <DatePicker
                        value={dataIntrare}
                        onChange={(v) => {
                          setDataIntrare(v)
                          persist({ data_intrare: v })
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label">Termen predare</label>
                      <DatePicker
                        value={termenPredare}
                        onChange={(v) => {
                          setTermenPredare(v)
                          persist({ termen_predare: v })
                        }}
                      />
                    </div>
                    <div>
                      <label className="field-label">Ora programare</label>
                      <TimePicker
                        value={oraProgramare}
                        onChange={(v) => {
                          setOraProgramare(v)
                          persist({ ora_programare: v })
                        }}
                      />
                    </div>
                  </div>
                  {termenPredare && (
                    <p className="detail-field-hint detail-programare-preview">
                      Programare: {formatDataOra(termenPredare, oraProgramare)}
                    </p>
                  )}
                  <div>
                    <label className="field-label">Next date</label>
                    <DatePicker
                      value={nextDate}
                      onChange={(v) => {
                        setNextDate(v)
                        persist({ next_date: v })
                      }}
                    />
                    <p className="detail-field-hint">Următoarea dată programată (probă, control etc.)</p>
                  </div>
                </section>

                <section className="detail-section">
                  <h3 className="detail-section-title">Notă</h3>
                  <textarea
                    className="text-input detail-nota"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    onBlur={(e) => persist({ nota: e.target.value })}
                    placeholder="Observații opționale…"
                  />
                </section>
              </div>
            </div>
          )}

          {tab === 'productie' && (
            <ProductieTimeline lucrareId={lucrare.id} dataIntrare={dataIntrare} termenPredare={termenPredare} />
          )}

          {tab === 'galerie' && <GaleriePoze lucrareId={lucrare.id} />}

          {tab === 'chat' && (
            <div className="detail-tab-placeholder">
              <p>Chat — disponibil în curând</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
