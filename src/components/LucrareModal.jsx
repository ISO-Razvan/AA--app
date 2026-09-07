import { useEffect, useMemo, useState } from 'react'
import { addLucrare, getConfigList, addConfigValue, generateNrInregistrare } from '../services/dataService'
import { MODEL_OPTIONS } from '../data/configDefaults'
import { calculeazaDinti, toggleLinkPair, toggleToothSelection } from '../utils/dintiGrupuri'
import { azi as todayISO } from '../utils/date'
import DentalChart from './DentalChart.jsx'
import SearchableSelect from './SearchableSelect.jsx'
import DatePicker from './DatePicker.jsx'
import TimePicker from './TimePicker.jsx'
import './LucrareModal.css'

function formatDataOra(dataStr, oraStr) {
  if (!dataStr) return ''
  const [an, luna, zi] = dataStr.split('-')
  const dataFmt = `${zi}.${luna}.${an}`
  return oraStr ? `${dataFmt}, ${oraStr}` : dataFmt
}

export default function LucrareModal({ onClose, onSaved }) {
  const [selectateNumere, setSelectateNumere] = useState([])
  const [linkPairs, setLinkPairs] = useState([])
  const [nrElemente, setNrElemente] = useState(0)
  const [clinica, setClinica] = useState('')
  const [medic, setMedic] = useState('')
  const [pacient, setPacient] = useState('')
  const [tipLucrare, setTipLucrare] = useState('')
  const [culoare, setCuloare] = useState('')
  const [implant, setImplant] = useState(false)
  const [tryIn, setTryIn] = useState(false)
  const [model, setModel] = useState('')
  const [dataIntrare, setDataIntrare] = useState(todayISO())
  const [termenPredare, setTermenPredare] = useState('')
  const [oraProgramare, setOraProgramare] = useState('')
  const [nota, setNota] = useState('')

  const [tipuriOptions, setTipuriOptions] = useState([])
  const [culoriOptions, setCuloriOptions] = useState([])
  const [mediciOptions, setMediciOptions] = useState([])
  const [cliniciOptions, setCliniciOptions] = useState([])
  const [nrPreview, setNrPreview] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    async function load() {
      const [tipuri, culori, medici, clinici, nr] = await Promise.all([
        getConfigList('tipuri_lucrare'),
        getConfigList('culori'),
        getConfigList('medici'),
        getConfigList('clinici'),
        generateNrInregistrare(),
      ])
      setTipuriOptions(tipuri)
      setCuloriOptions(culori)
      setMediciOptions(medici)
      setCliniciOptions(clinici)
      setNrPreview(nr)
    }
    load()
  }, [])

  useEffect(() => {
    setNrElemente(selectateNumere.length)
  }, [selectateNumere])

  const toggleTooth = (numar) => {
    const next = toggleToothSelection(selectateNumere, linkPairs, numar)
    setSelectateNumere(next.selectateNumere)
    setLinkPairs(next.linkPairs)
  }

  const toggleLink = (a, b) => {
    setLinkPairs((prev) => toggleLinkPair(prev, a, b))
  }

  const handleAdd = (configTip, setOptions) => async (nume) => {
    const saved = await addConfigValue(configTip, nume)
    setOptions((prev) => (prev.includes(saved) ? prev : [...prev, saved]))
    return saved
  }

  const canSave = useMemo(() => tipLucrare.trim().length > 0 && !saving, [tipLucrare, saving])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!tipLucrare.trim()) {
      setError('Tipul lucrării este obligatoriu.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const dinti = calculeazaDinti(selectateNumere, linkPairs)
      await addLucrare({
        clinica,
        medic,
        pacient,
        tip_lucrare: tipLucrare.trim(),
        dinti,
        nr_elemente: nrElemente,
        culoare,
        implant,
        try_in: tryIn,
        model,
        data_intrare: dataIntrare,
        termen_predare: termenPredare,
        ora_programare: oraProgramare,
        nota,
      })
      await onSaved()
    } catch (err) {
      setError(err.message || 'A apărut o eroare la salvare.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Înregistrare lucrare nouă">
        <form onSubmit={handleSubmit} className="lucrare-form">
          <header className="modal-header">
            <div>
              <h2>Înregistrare lucrare nouă</h2>
              {nrPreview && <p className="modal-header-nr">Nr. înregistrare: {nrPreview}</p>}
            </div>
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
              ✕
            </button>
          </header>

          <div className="lucrare-form-body">
            <div className="lucrare-form-col lucrare-form-col-chart">
              <DentalChart
                selectateNumere={selectateNumere}
                linkPairs={linkPairs}
                onToggleTooth={toggleTooth}
                onToggleLink={toggleLink}
                culoare={culoare}
                culoriOptions={culoriOptions}
                onCuloareChange={setCuloare}
                onAddCuloare={handleAdd('culori', setCuloriOptions)}
              />
            </div>

            <div className="lucrare-form-col lucrare-form-col-fields">
              <section className="detail-section">
                <h3 className="detail-section-title">Client</h3>
                <div className="lucrare-form-row">
                  <SearchableSelect
                    label="Clinică"
                    value={clinica}
                    onChange={setClinica}
                    options={cliniciOptions}
                    onAddOption={handleAdd('clinici', setCliniciOptions)}
                    placeholder="Numele clinicii"
                  />
                  <SearchableSelect
                    label="Medic"
                    value={medic}
                    onChange={setMedic}
                    options={mediciOptions}
                    onAddOption={handleAdd('medici', setMediciOptions)}
                    placeholder="Numele medicului"
                  />
                </div>

                <div>
                  <label className="field-label">Pacient</label>
                  <input
                    type="text"
                    className="text-input"
                    value={pacient}
                    onChange={(e) => setPacient(e.target.value)}
                    placeholder="Nume sau inițiale"
                  />
                </div>
              </section>

              <section className="detail-section">
                <h3 className="detail-section-title">Lucrare</h3>
                <SearchableSelect
                  label="Tip lucrare"
                  required
                  value={tipLucrare}
                  onChange={setTipLucrare}
                  options={tipuriOptions}
                  onAddOption={handleAdd('tipuri_lucrare', setTipuriOptions)}
                  placeholder="ex. Coroană zirconiu"
                />

                <div className="lucrare-form-row">
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
                    />
                  </div>
                </div>

                <div className="lucrare-form-row-3">
                  <div>
                    <span className="field-label">Implant</span>
                    <div className="segmented" role="group" aria-label="Implant">
                      <button type="button" className={`segmented-option ${!implant ? 'active' : ''}`} onClick={() => setImplant(false)}>Nu</button>
                      <button type="button" className={`segmented-option ${implant ? 'active' : ''}`} onClick={() => setImplant(true)}>Da</button>
                    </div>
                  </div>
                  <div>
                    <span className="field-label">Try-in</span>
                    <div className="segmented" role="group" aria-label="Try-in">
                      <button type="button" className={`segmented-option ${!tryIn ? 'active' : ''}`} onClick={() => setTryIn(false)}>Nu</button>
                      <button type="button" className={`segmented-option ${tryIn ? 'active' : ''}`} onClick={() => setTryIn(true)}>Da</button>
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
                          onClick={() => setModel(opt)}
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
                <div className="lucrare-form-row-3">
                  <div>
                    <label className="field-label">Data intrare</label>
                    <DatePicker value={dataIntrare} onChange={setDataIntrare} />
                  </div>
                  <div>
                    <label className="field-label">Termen predare</label>
                    <DatePicker value={termenPredare} onChange={setTermenPredare} />
                  </div>
                  <div>
                    <label className="field-label">Ora programare</label>
                    <TimePicker value={oraProgramare} onChange={setOraProgramare} />
                  </div>
                </div>

                {termenPredare && (
                  <p className="lucrare-form-programare-preview">
                    Programare: {formatDataOra(termenPredare, oraProgramare)}
                  </p>
                )}
              </section>

              <section className="detail-section">
                <h3 className="detail-section-title">Notă</h3>
                <textarea
                  className="text-input"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Observații opționale…"
                />
              </section>
            </div>
          </div>

          {error && <p className="lucrare-form-error">{error}</p>}

          <footer className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Anulează
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {saving ? 'Se salvează…' : 'Salvează lucrarea'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
