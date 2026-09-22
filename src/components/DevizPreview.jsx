import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getDevizLucrari } from '../services/dataService'
import { formatSuma } from './SalariiPage.jsx'
import { downloadHTML } from '../utils/downloadHTML'
import './DevizPreview.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function randPerioada(randuri) {
  const date = randuri.map((r) => r.lucrare?.data_intrare).filter(Boolean).sort()
  if (date.length === 0) return ''
  const prima = date[0]
  const ultima = date[date.length - 1]
  return prima === ultima ? formatData(prima) : `${formatData(prima)} – ${formatData(ultima)}`
}

export default function DevizPreview({ deviz, onClose }) {
  const [randuri, setRanduri] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const r = await getDevizLucrari(deviz.id)
      r.sort((a, b) => (a.lucrare?.data_intrare || '').localeCompare(b.lucrare?.data_intrare || ''))
      setRanduri(r)
      setLoading(false)
    }
    load()
  }, [deviz.id])

  const handleDescarca = () => {
    const randuriHTML = randuri
      .map(
        (r) => `<tr>
          <td>${r.lucrare?.nr_inregistrare || ''}</td>
          <td>${r.lucrare?.pacient || '—'}</td>
          <td>${r.lucrare?.medic || '—'}</td>
          <td>${r.lucrare?.clinica || '—'}</td>
          <td>${r.lucrare?.tip_lucrare || ''}</td>
          <td>${formatData(r.lucrare?.data_intrare)}</td>
          <td>${formatSuma(r.suma)}</td>
        </tr>`
      )
      .join('')

    const body = `
      <h1>Algorithm Aesthetics</h1>
      <p>Registru lucrări laborator</p>
      <h2 style="margin-top:24px;">Deviz ${deviz.numar_deviz}</h2>
      <p>Clinică: ${deviz.clinica || '—'}</p>
      <p>Medic: ${deviz.medic}</p>
      <p>Data: ${formatData(deviz.data_generare)}${randPerioada(randuri) ? ` · Perioadă: ${randPerioada(randuri)}` : ''}</p>
      <table>
        <thead><tr><th>Nr. înreg.</th><th>Pacient</th><th>Medic</th><th>Clinică</th><th>Tip lucrare</th><th>Dată</th><th>Valoare</th></tr></thead>
        <tbody>${randuriHTML}</tbody>
        <tfoot><tr class="total-row"><td colspan="6">Total</td><td>${formatSuma(deviz.total)}</td></tr></tfoot>
      </table>`

    downloadHTML(`deviz-${deviz.numar_deviz}.html`, `Deviz ${deviz.numar_deviz}`, body)
  }

  return createPortal(
    <div className="print-overlay">
      <div className="print-overlay-toolbar no-print">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Închide
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleDescarca}>
          Descarcă
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Printează
        </button>
      </div>

      <div className="print-sheet deviz-sheet">
        <header className="deviz-sheet-header">
          <div>
            <h2>Algorithm Aesthetics</h2>
            <p className="deviz-sheet-sub">Registru lucrări laborator</p>
          </div>
          <div className="deviz-sheet-nr">
            <span className="deviz-sheet-nr-label">Deviz</span>
            <span className="deviz-sheet-nr-value">{deviz.numar_deviz}</span>
          </div>
        </header>

        <div className="deviz-sheet-info">
          <div>
            <span className="field-label">Clinică</span>
            <p>{deviz.clinica || '—'}</p>
          </div>
          <div>
            <span className="field-label">Medic</span>
            <p>{deviz.medic}</p>
          </div>
          <div>
            <span className="field-label">Data generării</span>
            <p>{formatData(deviz.data_generare)}</p>
          </div>
          {!loading && randPerioada(randuri) && (
            <div>
              <span className="field-label">Perioadă</span>
              <p>{randPerioada(randuri)}</p>
            </div>
          )}
        </div>

        {loading ? (
          <p className="print-sheet-empty">Se încarcă…</p>
        ) : (
          <table className="deviz-sheet-table">
            <thead>
              <tr>
                <th>Nr. înreg.</th>
                <th>Pacient</th>
                <th>Medic</th>
                <th>Clinică</th>
                <th>Tip lucrare</th>
                <th>Dată</th>
                <th>Valoare</th>
              </tr>
            </thead>
            <tbody>
              {randuri.map((r) => (
                <tr key={r.id}>
                  <td>{r.lucrare?.nr_inregistrare}</td>
                  <td>{r.lucrare?.pacient || '—'}</td>
                  <td>{r.lucrare?.medic || '—'}</td>
                  <td>{r.lucrare?.clinica || '—'}</td>
                  <td>{r.lucrare?.tip_lucrare}</td>
                  <td>{formatData(r.lucrare?.data_intrare)}</td>
                  <td>{formatSuma(r.suma)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="deviz-sheet-total-row">
                <td colSpan={6}>Total</td>
                <td>{formatSuma(deviz.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>,
    document.body
  )
}
