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

function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Defalcarea unei lucrări din deviz: dinți simpli, dinți pe implant, apoi
// extra-urile în ordinea salvată (Try-in-ul, dacă e bifat, e primul), din
// instantaneul lucrării. Lucrările mai vechi, fără prețul unitar al dinților
// salvat, primesc un singur rând „Dinți" cu restul sumei.
function defalcareLucrare(l) {
  if (!l) return []
  const extra = l.extra_uri || []
  const totalExtra = extra.reduce((s, e) => s + (Number(e.cantitate) || 0) * (Number(e.pret_unitar) || 0), 0)
  const n = Number(l.nr_elemente) || 0
  const nImplant = Math.min(n, (l.dinti || []).filter((d) => d.implant === true).length)
  const nSimplu = n - nImplant
  const randuri = []
  if (l.pret_dinte_simplu != null) {
    const pSimplu = Number(l.pret_dinte_simplu) || 0
    const pImplant = Number(l.pret_dinte_implant) || 0
    if (nSimplu > 0) randuri.push({ descriere: 'Dinți simpli', cantitate: nSimplu, unitar: pSimplu, total: nSimplu * pSimplu })
    if (nImplant > 0) randuri.push({ descriere: 'Dinți pe implant', cantitate: nImplant, unitar: pImplant, total: nImplant * pImplant })
  } else if (n > 0) {
    const totalDinti = (Number(l.incasare) || 0) - totalExtra
    randuri.push({ descriere: 'Dinți', cantitate: n, unitar: totalDinti / n, total: totalDinti })
  }
  for (const e of extra) {
    const cantitate = Number(e.cantitate) || 0
    const unitar = Number(e.pret_unitar) || 0
    randuri.push({ descriere: e.nume, cantitate, unitar, total: cantitate * unitar })
  }
  return randuri
}

// Antetul unei lucrări din deviz, după pacient (afișat separat, îngroșat):
// medic, tip lucrare, apoi nr. înregistrare, clinică, dată.
function antetLucrare(l) {
  if (!l) return []
  return [
    l.medic && `Medic: ${l.medic}`,
    l.tip_lucrare,
    l.nr_inregistrare,
    l.clinica && `Clinică: ${l.clinica}`,
    formatData(l.data_intrare),
  ].filter(Boolean)
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
      .map((r) => {
        const antet = `<tr style="background:#F2F4FB;"><td colspan="4"><strong>${escapeHTML(r.lucrare?.pacient || '—')}</strong> · ${antetLucrare(r.lucrare).map(escapeHTML).join(' · ')}</td></tr>`
        const detalii = defalcareLucrare(r.lucrare)
          .map(
            (d) => `<tr>
          <td style="padding-left:24px;">${escapeHTML(d.descriere)}</td>
          <td>${d.cantitate}</td>
          <td>${formatSuma(d.unitar)}</td>
          <td>${formatSuma(d.total)}</td>
        </tr>`
          )
          .join('')
        const total = `<tr><td colspan="3" style="font-weight:600;">Total ${escapeHTML(r.lucrare?.nr_inregistrare)}</td><td style="font-weight:600;">${formatSuma(r.suma)}</td></tr>`
        return antet + detalii + total
      })
      .join('')

    const perioada = randPerioada(randuri)
    const body = `
      <h1>Algorithm Aesthetics</h1>
      <p>Registru lucrări laborator</p>
      <h2 style="margin-top:24px;">Deviz ${escapeHTML(deviz.numar_deviz)}</h2>
      <p>Clinică: ${escapeHTML(deviz.clinica || '—')}</p>
      <p>Medic: ${escapeHTML(deviz.medic)}</p>
      <p>Data: ${formatData(deviz.data_generare)}${perioada ? ` · Perioadă: ${perioada}` : ''}</p>
      <table>
        <thead><tr><th>Descriere</th><th>Cant.</th><th>Preț unitar</th><th>Total</th></tr></thead>
        <tbody>${randuriHTML}</tbody>
        <tfoot><tr class="total-row"><td colspan="3">Total deviz</td><td>${formatSuma(deviz.total)}</td></tr></tfoot>
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
                <th>Descriere</th>
                <th className="deviz-num">Cant.</th>
                <th className="deviz-num">Preț unitar</th>
                <th className="deviz-num">Total</th>
              </tr>
            </thead>
            {randuri.map((r) => (
              <tbody key={r.id} className="deviz-lucrare">
                <tr className="deviz-lucrare-antet">
                  <td colSpan={4}>
                    <strong>{r.lucrare?.pacient || '—'}</strong>
                    {antetLucrare(r.lucrare).map((t, i) => (
                      <span key={i}> · {t}</span>
                    ))}
                  </td>
                </tr>
                {defalcareLucrare(r.lucrare).map((d, i) => (
                  <tr key={i} className="deviz-lucrare-rand">
                    <td>{d.descriere}</td>
                    <td className="deviz-num">{d.cantitate}</td>
                    <td className="deviz-num">{formatSuma(d.unitar)}</td>
                    <td className="deviz-num">{formatSuma(d.total)}</td>
                  </tr>
                ))}
                <tr className="deviz-lucrare-total">
                  <td colSpan={3}>Total {r.lucrare?.nr_inregistrare}</td>
                  <td className="deviz-num">{formatSuma(r.suma)}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr className="deviz-sheet-total-row">
                <td colSpan={3}>Total deviz</td>
                <td className="deviz-num">{formatSuma(deviz.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>,
    document.body
  )
}
