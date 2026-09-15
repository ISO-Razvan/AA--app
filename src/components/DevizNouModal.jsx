import { useEffect, useMemo, useState } from 'react'
import { getConfigList, getLucrari, getEtapeProductie, getToateAlocarile, getLucrareIdsFacturate, creeazaDeviz } from '../services/dataService'
import { statusDinRanduri } from '../utils/statusLucrare'
import { formatSuma } from './SalariiPage.jsx'
import SearchableSelect from './SearchableSelect.jsx'
import { useConfirm } from '../hooks/useConfirm.jsx'
import './DevizNouModal.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

export default function DevizNouModal({ onClose, onGenerated }) {
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [mediciOptions, setMediciOptions] = useState([])
  const [medic, setMedic] = useState('')
  const [lucrari, setLucrari] = useState([])
  const [etape, setEtape] = useState([])
  const [alocari, setAlocari] = useState([])
  const [idsFacturate, setIdsFacturate] = useState(new Set())
  const [arataFacturate, setArataFacturate] = useState(false)
  const [selectate, setSelectate] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [medici, l, e, a, facturate] = await Promise.all([
        getConfigList('medici'),
        getLucrari(),
        getEtapeProductie(),
        getToateAlocarile(),
        getLucrareIdsFacturate(),
      ])
      setMediciOptions(medici)
      setLucrari(l)
      setEtape(e)
      setAlocari(a)
      setIdsFacturate(new Set(facturate))
      setLoading(false)
    }
    load()
  }, [])

  // Lucrările medicului, cu status calculat — eligibile pentru deviz sunt cele
  // Finalizate sau În lucru (Neînceput rămâne exclus, n-are ce factura încă).
  const lucrariMedic = useMemo(() => {
    if (!medic) return []
    return lucrari
      .filter((l) => l.medic === medic)
      .map((l) => {
        const randuri = alocari.filter((a) => a.lucrare_id === l.id)
        return { ...l, status: statusDinRanduri(etape.length, randuri) }
      })
      .filter((l) => l.status.id === 'finalizat' || l.status.id === 'in_lucru')
  }, [lucrari, etape, alocari, medic])

  const lucrariAfisate = useMemo(
    () => (arataFacturate ? lucrariMedic : lucrariMedic.filter((l) => !idsFacturate.has(l.id))),
    [lucrariMedic, idsFacturate, arataFacturate]
  )

  useEffect(() => {
    setSelectate(new Set())
  }, [medic])

  const toggleSelectie = (id) => {
    setSelectate((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalSelectat = useMemo(
    () => lucrariAfisate.filter((l) => selectate.has(l.id)).reduce((sum, l) => sum + (Number(l.incasare) || 0), 0),
    [lucrariAfisate, selectate]
  )

  const handleGenereaza = async () => {
    const lucrariSelectate = lucrariAfisate.filter((l) => selectate.has(l.id))
    if (lucrariSelectate.length === 0) return

    const neterminate = lucrariSelectate.filter((l) => l.status.id === 'in_lucru')
    if (neterminate.length > 0) {
      const ok = await confirm(
        `Devizul include ${neterminate.length} ${neterminate.length === 1 ? 'lucrare neterminată' : 'lucrări neterminate'}. Continui?`,
        { title: 'Lucrări neterminate în deviz', confirmLabel: 'Continuă' }
      )
      if (!ok) return
    }

    setGenerating(true)
    setError('')
    try {
      // Clinica devizului: cea comună tuturor lucrărilor selectate, dacă există una.
      const clinici = new Set(lucrariSelectate.map((l) => l.clinica).filter(Boolean))
      const clinica = clinici.size === 1 ? [...clinici][0] : ''

      const deviz = await creeazaDeviz({
        medic,
        clinica,
        lucrari: lucrariSelectate.map((l) => ({ id: l.id, suma: l.incasare })),
      })
      await onGenerated(deviz)
    } catch (err) {
      setError(err.message || 'A apărut o eroare la generarea devizului.')
      setGenerating(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel deviz-nou-panel" role="dialog" aria-modal="true" aria-label="Deviz nou">
        <header className="modal-header">
          <h2>Deviz nou</h2>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        </header>

        <div className="deviz-nou-body">
          <div className="deviz-nou-medic-row">
            <SearchableSelect
              label="Medic"
              value={medic}
              onChange={setMedic}
              options={mediciOptions}
              onAddOption={async (nume) => nume}
              placeholder="Caută un medic…"
            />
            <label className="deviz-nou-arata-facturate">
              <input type="checkbox" checked={arataFacturate} onChange={(e) => setArataFacturate(e.target.checked)} />
              <span>Arată și lucrările deja facturate</span>
            </label>
          </div>

          {!medic ? (
            <p className="deviz-nou-hint">Alege un medic ca să vezi lucrările lui finalizate sau în lucru.</p>
          ) : loading ? (
            <p className="deviz-nou-hint">Se încarcă…</p>
          ) : lucrariAfisate.length === 0 ? (
            <p className="deviz-nou-hint">
              Nicio lucrare finalizată sau în lucru{arataFacturate ? '' : ' și nefacturată încă'} pentru acest medic.
            </p>
          ) : (
            <ul className="deviz-nou-list">
              {lucrariAfisate.map((l) => (
                <li key={l.id} className={`deviz-nou-item ${idsFacturate.has(l.id) ? 'deja-facturata' : ''}`}>
                  <label className="deviz-nou-item-label">
                    <input type="checkbox" checked={selectate.has(l.id)} onChange={() => toggleSelectie(l.id)} />
                    <div className="deviz-nou-item-body">
                      <div className="deviz-nou-item-top">
                        <span className="deviz-nou-item-nr">{l.nr_inregistrare}</span>
                        <span className={`badge ${l.status.badgeClass}`}>{l.status.label}</span>
                        {l.status.id === 'in_lucru' && <span className="badge badge-warning">Neterminată</span>}
                        {idsFacturate.has(l.id) && <span className="badge badge-neutral">Deja facturată</span>}
                      </div>
                      <p className="deviz-nou-item-sub">
                        {l.tip_lucrare} · Pacient: {l.pacient || '—'} · {formatData(l.data_intrare)}
                      </p>
                    </div>
                  </label>
                  <span className="deviz-nou-item-suma">{formatSuma(l.incasare)}</span>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="lucrare-form-error">{error}</p>}
        </div>

        <footer className="modal-footer deviz-nou-footer">
          <span className="deviz-nou-total">
            {selectate.size} {selectate.size === 1 ? 'lucrare selectată' : 'lucrări selectate'} · {formatSuma(totalSelectat)}
          </span>
          <div className="deviz-nou-footer-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Anulează
            </button>
            <button type="button" className="btn btn-primary" onClick={handleGenereaza} disabled={selectate.size === 0 || generating}>
              {generating ? 'Se generează…' : 'Generează deviz'}
            </button>
          </div>
        </footer>
      </div>

      {confirmDialog}
    </div>
  )
}
