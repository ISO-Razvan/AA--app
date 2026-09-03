import { useEffect, useMemo, useState } from 'react'
import {
  addLucrare,
  updateLucrare,
  getConfigList,
  addConfigValue,
  generateNrInregistrare,
} from '../services/dataService'
import { MODEL_OPTIONS } from '../data/configDefaults'
import { calculeazaDinti, dinDintiSalvati, toggleLinkPair, toggleToothSelection } from '../utils/dintiGrupuri'
import DentalChart from './DentalChart.jsx'
import SearchableSelect from './SearchableSelect.jsx'
import './LucrareModal.css'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function LucrareModal({ lucrare, onClose, onSaved }) {
  const isEdit = !!lucrare
  const initial = useMemo(() => dinDintiSalvati(lucrare?.dinti), [lucrare])

  const [selectateNumere, setSelectateNumere] = useState(initial.selectateNumere)
  const [linkPairs, setLinkPairs] = useState(initial.linkPairs)
  const [nrElemente, setNrElemente] = useState(initial.selectateNumere.length)
  const [clinica, setClinica] = useState(lucrare?.clinica || '')
  const [medic, setMedic] = useState(lucrare?.medic || '')
  const [pacient, setPacient] = useState(lucrare?.pacient || '')
  const [tipLucrare, setTipLucrare] = useState(lucrare?.tip_lucrare || '')
  const [culoare, setCuloare] = useState(lucrare?.culoare || '')
  const [implant, setImplant] = useState(lucrare?.implant || false)
  const [model, setModel] = useState(lucrare?.model || '')
  const [dataIntrare, setDataIntrare] = useState(lucrare?.data_intrare || todayISO())
  const [termenPredare, setTermenPredare] = useState(lucrare?.termen_predare || '')
  const [nextDate, setNextDate] = useState(lucrare?.next_date || '')
  const [nota, setNota] = useState(lucrare?.nota || '')

  const [tipuriOptions, setTipuriOptions] = useState([])
  const [culoriOptions, setCuloriOptions] = useState([])
  const [mediciOptions, setMediciOptions] = useState([])
  const [cliniciOptions, setCliniciOptions] = useState([])
  const [nrPreview, setNrPreview] = useState(lucrare?.nr_inregistrare || '')

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
      if (!isEdit) setNrPreview(await generateNrInregistrare())
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const payload = {
        clinica,
        medic,
        pacient,
        tip_lucrare: tipLucrare.trim(),
        dinti,
        nr_elemente: nrElemente,
        culoare,
        implant,
        model,
        data_intrare: dataIntrare,
        termen_predare: termenPredare,
        nota,
      }
      if (isEdit) {
        await updateLucrare(lucrare.id, { ...payload, next_date: nextDate })
      } else {
        await addLucrare(payload)
      }
      await onSaved()
    } catch (err) {
      setError(err.message || 'A apărut o eroare la salvare.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={isEdit ? 'Editare lucrare' : 'Înregistrare lucrare nouă'}>
        <form onSubmit={handleSubmit} className="lucrare-form">
          <header className="modal-header">
            <div>
              <h2>{isEdit ? 'Editare lucrare' : 'Înregistrare lucrare nouă'}</h2>
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

              <div className="lucrare-form-row">
                <div>
                  <span className="field-label">Implant</span>
                  <div className="segmented" role="group" aria-label="Implant">
                    <button type="button" className={`segmented-option ${!implant ? 'active' : ''}`} onClick={() => setImplant(false)}>Nu</button>
                    <button type="button" className={`segmented-option ${implant ? 'active' : ''}`} onClick={() => setImplant(true)}>Da</button>
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

              <div className="lucrare-form-row">
                <div>
                  <label className="field-label">Data intrare</label>
                  <input
                    type="date"
                    className="text-input"
                    value={dataIntrare}
                    onChange={(e) => setDataIntrare(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">Termen predare</label>
                  <input
                    type="date"
                    className="text-input"
                    value={termenPredare}
                    onChange={(e) => setTermenPredare(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Notă</label>
                <textarea
                  className="text-input"
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Observații opționale…"
                />
              </div>

              {isEdit && (
                <div className="lucrare-form-edit-only">
                  <div>
                    <label className="field-label">Next date</label>
                    <input
                      type="date"
                      className="text-input"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                    />
                    <p className="field-hint">Următoarea dată programată (probă, control etc.)</p>
                  </div>

                  <div className="lucrare-form-programare">
                    <span className="field-label">Programare producție</span>
                    <p className="lucrare-form-programare-placeholder">
                      Programarea etapei de producție și a tehnicianului responsabil va fi disponibilă aici într-o versiune viitoare.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <p className="lucrare-form-error">{error}</p>}

          <footer className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Anulează
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {saving ? 'Se salvează…' : isEdit ? 'Salvează modificările' : 'Salvează lucrarea'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
