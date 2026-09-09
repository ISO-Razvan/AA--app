import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { importLucrari, addLucrare, updateLucrare, deleteLucrare, getEtapeProductie, getToateAlocarile, getConfigList } from '../services/dataService'
import { lucrariToCSV, parseCSV, downloadCSV, CSV_COLUMNS } from '../utils/csv'
import { lucrariDemo } from '../utils/demoData'
import { azi } from '../utils/date'
import { statusDinRanduri } from '../utils/statusLucrare'
import { subscribeToTable } from '../services/realtime'
import LucrariKanban from './LucrariKanban.jsx'
import './LucrariList.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function clientLabel(l) {
  const parts = [l.clinica, l.medic].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : '—'
}

function detaliiLabel(l) {
  const parts = []
  if (l.culoare) parts.push(l.culoare)
  if (l.model) parts.push(l.model)
  parts.push(`${l.nr_elemente ?? 0} elem.`)
  return parts.join(' · ')
}

function IconStergere() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.5H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 4.5V3.2C6 2.65 6.45 2.2 7 2.2H9C9.55 2.2 10 2.65 10 3.2V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4.5L5 12.7C5.03 13.28 5.5 13.73 6.08 13.73H9.92C10.5 13.73 10.97 13.28 11 12.7L11.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function matchesSearch(l, query) {
  if (!query) return true
  const haystack = [l.nr_inregistrare, l.pacient, l.medic, l.clinica, l.tip_lucrare, l.nota]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export default function LucrariList({ lucrari, loading, onDataChanged, onRowClick, onNewLucrare }) {
  const fileInputRef = useRef(null)
  const [importSummary, setImportSummary] = useState(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')
  const [totalEtape, setTotalEtape] = useState(0)
  const [alocari, setAlocari] = useState([])
  const [deletingId, setDeletingId] = useState(null)
  const [view, setView] = useState('lista')
  const [modFiltrare, setModFiltrare] = useState('active')
  const [tipuriLucrareNume, setTipuriLucrareNume] = useState(null) // null = încă neîncărcat

  useEffect(() => {
    async function load() {
      const [etape, toateAlocarile, tipuri] = await Promise.all([
        getEtapeProductie(),
        getToateAlocarile(),
        getConfigList('tipuri_lucrare'),
      ])
      setTotalEtape(etape.length)
      setAlocari(toateAlocarile)
      setTipuriLucrareNume(tipuri)
    }
    load()
  }, [])

  const reincarcaAlocarile = useCallback(async () => {
    setAlocari(await getToateAlocarile())
  }, [])

  // Realtime: coloana „Status" reflectă automat o bifare venită din altă
  // parte (Task-uri, Producție), la fel ca la Kanban/Dashboard.
  useEffect(() => {
    const unsubscribe = subscribeToTable('productie_lucrare', () => reincarcaAlocarile())
    return unsubscribe
  }, [reincarcaAlocarile])

  const statusPentru = (lucrareId) =>
    statusDinRanduri(totalEtape, alocari.filter((a) => a.lucrare_id === lucrareId))

  const sourceLucrari = useMemo(
    () => lucrari.filter((l) => (modFiltrare === 'arhivate' ? !!l.arhivat : !l.arhivat)),
    [lucrari, modFiltrare]
  )

  const filtered = useMemo(() => sourceLucrari.filter((l) => matchesSearch(l, search)), [sourceLucrari, search])

  const schimbaModFiltrare = (mod) => {
    setModFiltrare(mod)
    if (mod === 'arhivate') setView('lista')
  }

  const handleExport = () => {
    const csv = lucrariToCSV(lucrari)
    const stamp = azi()
    downloadCSV(`lucrari-${stamp}.csv`, csv)
  }

  const handleSeedDemo = async () => {
    setSeeding(true)
    setDemoMessage('')
    try {
      const demo = lucrariDemo(tipuriLucrareNume)
      for (const { _nextDate, ...payload } of demo) {
        const lucrare = await addLucrare(payload)
        if (_nextDate) await updateLucrare(lucrare.id, { next_date: _nextDate })
      }
      setDemoMessage(`${demo.length} lucrări demo adăugate.`)
      await onDataChanged()
    } catch (err) {
      setDemoMessage(`Eroare la adăugarea datelor demo: ${err.message}`)
    } finally {
      setSeeding(false)
    }
  }

  const handleDelete = async (l, e) => {
    e.stopPropagation()
    const ok = window.confirm(`Ștergi definitiv lucrarea ${l.nr_inregistrare}${l.pacient ? ` (${l.pacient})` : ''}? Acțiunea nu poate fi anulată.`)
    if (!ok) return
    setDeletingId(l.id)
    try {
      await deleteLucrare(l.id)
      await onDataChanged()
    } finally {
      setDeletingId(null)
    }
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const rezultat = await importLucrari(rows)
      setImportSummary(rezultat)
      await onDataChanged()
    } catch (err) {
      setImportSummary({ importate: 0, sarite: 0, erori: [], eroareGenerala: err.message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="lucrari-list">
      <div className="lucrari-list-toolbar">
        <div>
          <h2>Lista lucrărilor</h2>
          <p className="lucrari-list-count">
            {loading
              ? 'Se încarcă…'
              : search
                ? `${filtered.length} din ${sourceLucrari.length} lucrări`
                : modFiltrare === 'arhivate'
                  ? `${sourceLucrari.length} lucrări arhivate`
                  : `${sourceLucrari.length} lucrări active`}
          </p>
        </div>
        <div className="lucrari-list-toolbar-actions">
          <button type="button" className="btn btn-primary" onClick={onNewLucrare}>
            + Înregistrare lucrare
          </button>
          <button
            type="button"
            className="btn btn-ghost lucrari-demo-btn"
            onClick={handleSeedDemo}
            disabled={seeding || tipuriLucrareNume?.length === 0}
            title={tipuriLucrareNume?.length === 0 ? 'Configurează cel puțin un tip de lucrare în Setup înainte de a genera date demo.' : undefined}
          >
            {seeding ? 'Se adaugă…' : '+ 10 lucrări demo'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={loading}>
            Export CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleImportClick} disabled={importing}>
            {importing ? 'Se importă…' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={handleFileSelected}
          />
        </div>
      </div>

      <div className="lucrari-search-row">
        <div className="lucrari-search">
          <input
            type="search"
            className="text-input"
            placeholder="Caută după nr. înreg., pacient, medic, clinică, tip lucrare sau notă…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="lucrari-filtru-toggle segmented" role="group" aria-label="Active sau arhivate">
          <button
            type="button"
            className={`segmented-option ${modFiltrare === 'active' ? 'active' : ''}`}
            onClick={() => schimbaModFiltrare('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={`segmented-option ${modFiltrare === 'arhivate' ? 'active' : ''}`}
            onClick={() => schimbaModFiltrare('arhivate')}
          >
            Arhivate
          </button>
        </div>
        <div className="lucrari-view-toggle segmented" role="group" aria-label="Mod de afișare">
          <button
            type="button"
            className={`segmented-option ${view === 'lista' ? 'active' : ''}`}
            onClick={() => setView('lista')}
          >
            Listă
          </button>
          <button
            type="button"
            className={`segmented-option ${view === 'kanban' ? 'active' : ''}`}
            onClick={() => setView('kanban')}
            disabled={modFiltrare === 'arhivate'}
            title={modFiltrare === 'arhivate' ? 'Kanban nu e disponibil pentru lucrările arhivate' : undefined}
          >
            Kanban
          </button>
        </div>
      </div>

      {tipuriLucrareNume?.length === 0 && (
        <div className="import-summary import-summary-notice">
          <p>Configurează cel puțin un tip de lucrare în Setup înainte de a genera date demo.</p>
        </div>
      )}

      {demoMessage && (
        <div className={`import-summary ${demoMessage.startsWith('Eroare') ? 'import-summary-warn' : 'import-summary-ok'}`}>
          <p>{demoMessage}</p>
          <button type="button" className="btn btn-ghost import-summary-dismiss" onClick={() => setDemoMessage('')}>
            Închide
          </button>
        </div>
      )}

      {importSummary && (
        <div
          className={`import-summary ${importSummary.sarite > 0 || importSummary.eroareGenerala ? 'import-summary-warn' : 'import-summary-ok'}`}
        >
          {importSummary.eroareGenerala ? (
            <p>Import eșuat: {importSummary.eroareGenerala}</p>
          ) : (
            <>
              <p>
                <strong>{importSummary.importate}</strong> lucrări importate cu succes
                {importSummary.sarite > 0 && (
                  <>
                    , <strong>{importSummary.sarite}</strong> sărite
                  </>
                )}
                .
              </p>
              {importSummary.erori.length > 0 && (
                <ul>
                  {importSummary.erori.map((e, i) => (
                    <li key={i}>Rândul {e.rand}: {e.motiv}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button type="button" className="btn btn-ghost import-summary-dismiss" onClick={() => setImportSummary(null)}>
            Închide
          </button>
        </div>
      )}

      {!loading && sourceLucrari.length === 0 && (
        <div className="card lucrari-empty">
          <p>
            {modFiltrare === 'arhivate'
              ? 'Nicio lucrare arhivată încă.'
              : 'Nu există încă lucrări înregistrate.'}
          </p>
        </div>
      )}

      {!loading && sourceLucrari.length > 0 && filtered.length === 0 && (
        <div className="card lucrari-empty">
          <p>Nicio lucrare nu corespunde căutării „{search}”.</p>
        </div>
      )}

      {filtered.length > 0 && view === 'kanban' && (
        <LucrariKanban lucrari={filtered} onRowClick={onRowClick} />
      )}

      {filtered.length > 0 && view === 'lista' && (
        <>
          <div className="card lucrari-table-wrap">
            <table className="lucrari-table">
              <thead>
                <tr>
                  <th>Nr. înreg.</th>
                  <th>Client</th>
                  <th>Pacient</th>
                  <th className="lucrari-col-optional">Data intrare</th>
                  <th className="lucrari-col-optional">Next date</th>
                  <th>Termen predare</th>
                  <th>Status</th>
                  <th>Tip lucrare</th>
                  <th className="lucrari-col-optional">Detalii</th>
                  <th className="lucrari-col-optional">Notă</th>
                  <th aria-label="Acțiuni" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const status = statusPentru(l.id)
                  return (
                    <tr key={l.id} className="lucrari-table-row" onClick={() => onRowClick(l)} tabIndex={0}>
                      <td className="lucrari-table-nr">{l.nr_inregistrare}</td>
                      <td>{clientLabel(l)}</td>
                      <td>{l.pacient || '—'}</td>
                      <td className="lucrari-col-optional">{formatData(l.data_intrare)}</td>
                      <td className="lucrari-col-optional">{formatData(l.next_date)}</td>
                      <td className="lucrari-table-livrare">{formatData(l.termen_predare)}</td>
                      <td><span className={`badge ${status.badgeClass}`}>{status.label}</span></td>
                      <td>{l.tip_lucrare}</td>
                      <td className="lucrari-col-optional"><span className="badge badge-neutral">{detaliiLabel(l)}</span></td>
                      <td className="lucrari-col-optional lucrari-table-nota">{l.nota || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="lucrari-delete-btn"
                          onClick={(e) => handleDelete(l, e)}
                          disabled={deletingId === l.id || l.arhivat}
                          aria-label={`Șterge lucrarea ${l.nr_inregistrare}`}
                          title={l.arhivat ? 'Lucrare arhivată — needitabilă' : 'Șterge lucrarea'}
                        >
                          <IconStergere />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="lucrari-cards">
            {filtered.map((l) => {
              const status = statusPentru(l.id)
              return (
              <li key={l.id} className="card lucrare-card" onClick={() => onRowClick(l)}>
                <div className="lucrare-card-top">
                  <span className="lucrare-card-nr">{l.nr_inregistrare}</span>
                  <div className="lucrare-card-top-right">
                    <span className="lucrare-card-livrare">Termen: {formatData(l.termen_predare)}</span>
                    <button
                      type="button"
                      className="lucrari-delete-btn"
                      onClick={(e) => handleDelete(l, e)}
                      disabled={deletingId === l.id || l.arhivat}
                      aria-label={`Șterge lucrarea ${l.nr_inregistrare}`}
                      title={l.arhivat ? 'Lucrare arhivată — needitabilă' : 'Șterge lucrarea'}
                    >
                      <IconStergere />
                    </button>
                  </div>
                </div>
                <h3 className="lucrare-card-tip">{l.tip_lucrare}</h3>
                <p className="lucrare-card-line">{clientLabel(l)}</p>
                <p className="lucrare-card-line">Pacient: {l.pacient || '—'}</p>
                <div className="lucrare-badges">
                  <span className={`badge ${status.badgeClass}`}>{status.label}</span>
                  <span className="badge badge-neutral">{detaliiLabel(l)}</span>
                </div>
                <div className="lucrare-card-grid">
                  <div>
                    <span className="field-label">Data intrare</span>
                    <p>{formatData(l.data_intrare)}</p>
                  </div>
                  <div>
                    <span className="field-label">Next date</span>
                    <p>{formatData(l.next_date)}</p>
                  </div>
                </div>
                {l.nota && (
                  <div>
                    <span className="field-label">Notă</span>
                    <p>{l.nota}</p>
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="lucrari-csv-hint">
        Coloanele CSV: {CSV_COLUMNS.join(', ')}
      </p>
    </div>
  )
}
