import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  updateLucrare,
  updateLucrareSiRecalculeaza,
  deleteLucrare,
  getConfigList,
  addConfigValue,
  getEtapeProductie,
  getProductieLucrare,
  getExtraUri,
} from '../services/dataService'
import { MODEL_OPTIONS } from '../data/configDefaults'
import { calculeazaDinti, dinDintiSalvati, toggleImplant, toggleLinkPair, toggleToothSelection } from '../utils/dintiGrupuri'
import { statusDinRanduri } from '../utils/statusLucrare'
import DentalChart from './DentalChart.jsx'
import SearchableSelect from './SearchableSelect.jsx'
import DatePicker from './DatePicker.jsx'
import TimePicker from './TimePicker.jsx'
import ProductieTimeline from './ProductieTimeline.jsx'
import GaleriePoze from './GaleriePoze.jsx'
import ExtraUriPicker, { ExtraUriLista } from './ExtraUriPicker.jsx'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './modal-base.css'
import './LucrareDetailPanel.css'

function formatDataOra(dataStr, oraStr) {
  if (!dataStr) return ''
  const [an, luna, zi] = dataStr.split('-')
  const dataFmt = `${zi}.${luna}.${an}`
  return oraStr ? `${dataFmt}, ${oraStr}` : dataFmt
}

function formatDataArhivare(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TABS = [
  { id: 'detalii', label: 'Detalii comandă' },
  { id: 'productie', label: 'Producție' },
  { id: 'galerie', label: 'Galerie' },
  { id: 'chat', label: 'Chat' },
]

export default function LucrareDetailPanel({ lucrare, profile, onClose, onUpdated }) {
  const readOnly = !!lucrare.arhivat
  const esteAdmin = profile?.rol === 'admin'
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [tab, setTab] = useState('detalii')
  const initial = dinDintiSalvati(lucrare.dinti)

  const [selectateNumere, setSelectateNumere] = useState(initial.selectateNumere)
  const [linkPairs, setLinkPairs] = useState(initial.linkPairs)
  const [implantNumere, setImplantNumere] = useState(initial.implantNumere)
  // Citit din coloana reală `nr_elemente`, nu din `dinti.length` — pot
  // diferi (ex. lucrări din Import CSV, unde nr_elemente vine dintr-o
  // coloană separată, fără marcarea dinților pe schemă).
  const [nrElemente, setNrElemente] = useState(lucrare.nr_elemente ?? 0)
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
  // null până se încarcă lista din Setup — fără ea nu știm care element din
  // `lucrare.extra_uri` e Try-in-ul (afișat doar ca bifă, nu și în listă).
  const [extraToate, setExtraToate] = useState(null)
  const [extraSelectie, setExtraSelectie] = useState([])

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

  useEffect(() => {
    async function loadExtra() {
      const toate = await getExtraUri()
      const tryInId = toate.find((e) => e.sistem === 'try_in')?.id
      setExtraSelectie(
        (lucrare.extra_uri || [])
          .filter((e) => e.extra_id !== tryInId)
          .map((e) => ({ extra_id: e.extra_id, nume: e.nume, mod_taxare: e.mod_taxare, cantitate: e.cantitate }))
      )
      setExtraToate(toate)
    }
    loadExtra()
    // Doar la deschiderea fișei — după aceea selecția locală e sursa afișării.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lucrare.id])

  // Extra-urile și bifa Try-in: doar admin, cu recalcularea instantaneului.
  const poateEditaFinanciar = esteAdmin && !readOnly

  const schimbaExtra = async (noua) => {
    if (!poateEditaFinanciar) return
    setExtraSelectie(noua)
    await updateLucrareSiRecalculeaza(lucrare.id, {
      extra_uri: noua.map((s) => ({ extra_id: s.extra_id, cantitate: s.cantitate })),
    })
    setSavedAt(Date.now())
    await onUpdated?.()
  }

  const schimbaTryIn = async (valoare) => {
    if (!poateEditaFinanciar) return
    setTryIn(valoare)
    await updateLucrareSiRecalculeaza(lucrare.id, { try_in: valoare })
    setSavedAt(Date.now())
    await onUpdated?.()
  }

  const persist = async (patch) => {
    if (readOnly) return
    await updateLucrare(lucrare.id, patch)
    setSavedAt(Date.now())
    await onUpdated?.()
  }

  const handleDelete = async () => {
    if (readOnly) return
    const ok = await confirm(
      `Ștergi definitiv lucrarea ${lucrare.nr_inregistrare}${lucrare.pacient ? ` (${lucrare.pacient})` : ''}? Acțiunea nu poate fi anulată.`,
      { title: 'Ștergi lucrarea?', confirmLabel: 'Șterge', danger: true }
    )
    if (!ok) return
    await deleteLucrare(lucrare.id)
    onClose()
    await onUpdated?.()
  }

  // Modificarea dinților / marcajelor de implant: câmpul `implant` al lucrării
  // se derivă automat, iar pentru un admin se recalculează și instantaneul
  // financiar al acestei lucrări (prețuri curente din Setup). Pentru ceilalți
  // utilizatori instantaneul rămâne înghețat de la înregistrare.
  const persistDinti = async (patch, nextImplant) => {
    if (readOnly) return
    const implantNou = nextImplant.length > 0
    setImplant(implantNou)
    const complet = { ...patch, implant: implantNou }
    if (esteAdmin) await updateLucrareSiRecalculeaza(lucrare.id, complet)
    else await updateLucrare(lucrare.id, complet)
    setSavedAt(Date.now())
    await onUpdated?.()
  }

  const toggleTooth = async (numar) => {
    const next = toggleToothSelection(selectateNumere, linkPairs, numar)
    const nextImplant = implantNumere.filter((n) => next.selectateNumere.includes(n))
    setSelectateNumere(next.selectateNumere)
    setLinkPairs(next.linkPairs)
    setImplantNumere(nextImplant)
    setNrElemente(next.selectateNumere.length)
    await persistDinti(
      {
        dinti: calculeazaDinti(next.selectateNumere, next.linkPairs, nextImplant),
        nr_elemente: next.selectateNumere.length,
      },
      nextImplant
    )
  }

  const toggleImplantDinte = async (numar) => {
    const nextImplant = toggleImplant(implantNumere, numar)
    setImplantNumere(nextImplant)
    await persistDinti({ dinti: calculeazaDinti(selectateNumere, linkPairs, nextImplant) }, nextImplant)
  }

  const toggleLink = async (a, b) => {
    const next = toggleLinkPair(linkPairs, a, b)
    setLinkPairs(next)
    await persist({ dinti: calculeazaDinti(selectateNumere, next, implantNumere) })
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
              {readOnly && <span className="badge badge-neutral">Arhivată</span>}
            </div>
            <p>{lucrare.nr_inregistrare}</p>
            {readOnly && (
              <p className="detail-panel-arhivat-hint">
                Arhivată{lucrare.data_arhivare ? ` pe ${formatDataArhivare(lucrare.data_arhivare)}` : ''} — needitabilă, doar de consultat.
              </p>
            )}
          </div>

          <div className="detail-panel-qr">
            <QRCodeSVG value={qrUrl} size={72} bgColor="transparent" fgColor="#1E2233" />
            <span>{lucrare.nr_inregistrare}</span>
          </div>

          <div className="detail-panel-header-actions">
            <button
              type="button"
              className="btn btn-ghost detail-panel-delete"
              onClick={handleDelete}
              disabled={readOnly}
              title={readOnly ? 'Lucrare arhivată — needitabilă' : undefined}
            >
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
                  implantNumere={implantNumere}
                  onToggleTooth={toggleTooth}
                  onToggleLink={toggleLink}
                  onToggleImplant={toggleImplantDinte}
                  culoare={culoare}
                  culoriOptions={culoriOptions}
                  onCuloareChange={async (v) => {
                    setCuloare(v)
                    await persist({ culoare: v })
                  }}
                  onAddCuloare={handleAdd('culori', setCuloriOptions)}
                  readOnly={readOnly}
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
                      disabled={readOnly}
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
                      disabled={readOnly}
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
                        disabled={readOnly}
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
                    disabled={readOnly}
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
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                  <div className="detail-field-row-3">
                    <div>
                      <span className="field-label">Implant</span>
                      <div className="culoare-readonly" title="Se stabilește automat din schema dentară">
                        {implant ? 'Da' : 'Nu'}
                        <span className="culoare-readonly-empty">&nbsp;· din schemă</span>
                      </div>
                    </div>
                    <div>
                      <span className="field-label">Try-in</span>
                      <div className="segmented" role="group" aria-label="Try-in">
                        <button
                          type="button"
                          className={`segmented-option ${!tryIn ? 'active' : ''}`}
                          onClick={() => schimbaTryIn(false)}
                          disabled={!poateEditaFinanciar}
                        >
                          Nu
                        </button>
                        <button
                          type="button"
                          className={`segmented-option ${tryIn ? 'active' : ''}`}
                          onClick={() => schimbaTryIn(true)}
                          disabled={!poateEditaFinanciar}
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
                            disabled={readOnly}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="field-label">Extra-uri</span>
                    {extraToate === null ? null : poateEditaFinanciar ? (
                      <ExtraUriPicker
                        optiuni={extraToate.filter((e) => e.activ && !e.sistem)}
                        selectie={extraSelectie}
                        onChange={schimbaExtra}
                      />
                    ) : (
                      <ExtraUriLista selectie={extraSelectie} />
                    )}
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
                        disabled={readOnly}
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
                        disabled={readOnly}
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
                        disabled={readOnly}
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
                      disabled={readOnly}
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
                    disabled={readOnly}
                  />
                </section>
              </div>
            </div>
          )}

          {tab === 'productie' && (
            <ProductieTimeline
              lucrareId={lucrare.id}
              dataIntrare={dataIntrare}
              termenPredare={termenPredare}
              arhivat={lucrare.arhivat}
              dataArhivare={lucrare.data_arhivare}
              onArhivat={onUpdated}
            />
          )}

          {tab === 'galerie' && <GaleriePoze lucrareId={lucrare.id} readOnly={readOnly} />}

          {tab === 'chat' && (
            <div className="detail-tab-placeholder">
              <p>Chat — disponibil în curând</p>
            </div>
          )}
        </div>
      </div>

      {confirmDialog}
    </div>
  )
}
