import { createPortal } from 'react-dom'
import { downloadHTML } from '../utils/downloadHTML'
import { termenPentru } from './TaskuriZiModal.jsx'
import './TaskuriZiPrint.css'

function formatZiLunga(dataStr) {
  const d = new Date(`${dataStr}T00:00:00`)
  const text = d.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatDataScurta(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

// Previzualizare + descărcare pentru task-urile unui tehnician într-o zi —
// același tipar folosit la checklist-ul de task-uri (PrintChecklist) și la
// devize (DevizPreview): overlay peste toată pagina, Închide/Descarcă/Printează.
export default function TaskuriZiPrint({ tehnician, zi, sarcini, onClose }) {
  const handleDescarca = () => {
    const randuriHTML = sarcini
      .map(({ lucrare, finalizat }) => {
        const termen = termenPentru(lucrare)
        return `<tr>
          <td><strong>${lucrare.pacient || '—'}</strong></td>
          <td>${lucrare.medic || '—'}</td>
          <td>${lucrare.tip_lucrare}</td>
          <td>${lucrare.nr_inregistrare}</td>
          <td>${lucrare.clinica || '—'}</td>
          <td>${lucrare.nr_elemente}</td>
          <td>${formatDataScurta(termen.data)}${termen.eticheta ? ` (${termen.eticheta})` : ''}</td>
          <td>${finalizat ? 'Da' : 'Nu'}</td>
        </tr>`
      })
      .join('')

    const body = `
      <h1>Algorithm Aesthetics</h1>
      <p>Registru lucrări laborator</p>
      <h2 style="margin-top:24px;">${tehnician.nume}</h2>
      <p>${formatZiLunga(zi)}</p>
      <table>
        <thead><tr><th>Pacient</th><th>Medic</th><th>Tip lucrare</th><th>Nr. înreg.</th><th>Clinică</th><th>Nr. elemente</th><th>Termen</th><th>Finalizat</th></tr></thead>
        <tbody>${randuriHTML}</tbody>
      </table>`

    downloadHTML(`taskuri-${tehnician.nume.replace(/\s+/g, '-')}-${zi}.html`, `Task-uri ${tehnician.nume} — ${zi}`, body)
  }

  return createPortal(
    <div className="print-overlay">
      <div className="print-overlay-toolbar no-print">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Închide
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleDescarca}>
          Descarcă PDF
        </button>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Printează
        </button>
      </div>

      <div className="print-sheet taskuri-zi-sheet">
        <header className="taskuri-zi-sheet-header">
          <div>
            <h2>Algorithm Aesthetics</h2>
            <p className="taskuri-zi-sheet-sub">Registru lucrări laborator</p>
          </div>
          <div className="taskuri-zi-sheet-nr">
            <span className="taskuri-zi-sheet-nr-label">Tehnician</span>
            <span className="taskuri-zi-sheet-nr-value">{tehnician.nume}</span>
          </div>
        </header>

        <p className="taskuri-zi-sheet-data">{formatZiLunga(zi)}</p>

        {sarcini.length === 0 ? (
          <p className="print-sheet-empty">Nicio sarcină programată pentru această zi.</p>
        ) : (
          <table className="taskuri-zi-sheet-table">
            <thead>
              <tr>
                <th>Pacient</th>
                <th>Medic</th>
                <th>Tip lucrare</th>
                <th>Nr. înreg.</th>
                <th>Clinică</th>
                <th>Nr. elemente</th>
                <th>Termen</th>
                <th>Finalizat</th>
              </tr>
            </thead>
            <tbody>
              {sarcini.map(({ cheie, finalizat, lucrare }) => {
                const termen = termenPentru(lucrare)
                return (
                  <tr key={cheie}>
                    <td className="rezumat-pacient">{lucrare.pacient || '—'}</td>
                    <td className="rezumat-medic">{lucrare.medic || '—'}</td>
                    <td className="rezumat-tip">{lucrare.tip_lucrare}</td>
                    <td>{lucrare.nr_inregistrare}</td>
                    <td>{lucrare.clinica || '—'}</td>
                    <td>{lucrare.nr_elemente}</td>
                    <td>
                      {formatDataScurta(termen.data)}
                      {termen.eticheta && <span className="taskuri-zi-termen-badge">{termen.eticheta}</span>}
                    </td>
                    <td>{finalizat ? 'Da' : 'Nu'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>,
    document.body
  )
}
