import { useMemo, useRef, useState } from 'react'
import { importLucrari } from '../services/dataService'
import { lucrariToCSV, parseCSV, downloadCSV, CSV_COLUMNS } from '../utils/csv'
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

function matchesSearch(l, query) {
  if (!query) return true
  const haystack = [l.nr_inregistrare, l.pacient, l.medic, l.clinica, l.tip_lucrare, l.nota]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export default function LucrariList({ lucrari, loading, onDataChanged, onRowClick }) {
  const fileInputRef = useRef(null)
  const [importSummary, setImportSummary] = useState(null)
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => lucrari.filter((l) => matchesSearch(l, search)), [lucrari, search])

  const handleExport = () => {
    const csv = lucrariToCSV(lucrari)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV(`lucrari-${stamp}.csv`, csv)
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
                ? `${filtered.length} din ${lucrari.length} lucrări`
                : `${lucrari.length} lucrări înregistrate`}
          </p>
        </div>
        <div className="lucrari-list-toolbar-actions">
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

      <div className="lucrari-search">
        <input
          type="search"
          className="text-input"
          placeholder="Caută după nr. înreg., pacient, medic, clinică, tip lucrare sau notă…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

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

      {!loading && lucrari.length === 0 && (
        <div className="card lucrari-empty">
          <p>Nu există încă lucrări înregistrate.</p>
        </div>
      )}

      {!loading && lucrari.length > 0 && filtered.length === 0 && (
        <div className="card lucrari-empty">
          <p>Nicio lucrare nu corespunde căutării „{search}”.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="card lucrari-table-wrap">
            <table className="lucrari-table">
              <thead>
                <tr>
                  <th>Nr. înreg.</th>
                  <th>Client</th>
                  <th>Pacient</th>
                  <th>Data intrare</th>
                  <th>Next date</th>
                  <th>Termen predare</th>
                  <th>Tip lucrare</th>
                  <th>Detalii</th>
                  <th>Notă</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="lucrari-table-row" onClick={() => onRowClick(l)} tabIndex={0}>
                    <td className="lucrari-table-nr">{l.nr_inregistrare}</td>
                    <td>{clientLabel(l)}</td>
                    <td>{l.pacient || '—'}</td>
                    <td>{formatData(l.data_intrare)}</td>
                    <td>{formatData(l.next_date)}</td>
                    <td className="lucrari-table-livrare">{formatData(l.termen_predare)}</td>
                    <td>{l.tip_lucrare}</td>
                    <td><span className="badge badge-neutral">{detaliiLabel(l)}</span></td>
                    <td className="lucrari-table-nota">{l.nota || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="lucrari-cards">
            {filtered.map((l) => (
              <li key={l.id} className="card lucrare-card" onClick={() => onRowClick(l)}>
                <div className="lucrare-card-top">
                  <span className="lucrare-card-nr">{l.nr_inregistrare}</span>
                  <span className="lucrare-card-livrare">Termen: {formatData(l.termen_predare)}</span>
                </div>
                <h3 className="lucrare-card-tip">{l.tip_lucrare}</h3>
                <p className="lucrare-card-line">{clientLabel(l)}</p>
                <p className="lucrare-card-line">Pacient: {l.pacient || '—'}</p>
                <span className="badge badge-neutral">{detaliiLabel(l)}</span>
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
            ))}
          </ul>
        </>
      )}

      <p className="lucrari-csv-hint">
        Coloanele CSV: {CSV_COLUMNS.join(', ')}
      </p>
    </div>
  )
}
