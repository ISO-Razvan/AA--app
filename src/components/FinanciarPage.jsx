import { useState } from 'react'
import FinanciarPrezentare from './FinanciarPrezentare.jsx'
import DevizePage from './DevizePage.jsx'
import './FinanciarPage.css'

export default function FinanciarPage({ onOpenLucrare }) {
  const [view, setView] = useState('prezentare')

  return (
    <div className="financiar-page">
      <div className="financiar-page-header">
        <div>
          <h2>Financiar</h2>
          <p className="financiar-page-hint">Producție, cheltuieli și devize pe medic.</p>
        </div>
        <div className="segmented financiar-view-toggle" role="group" aria-label="Secțiune financiar">
          <button
            type="button"
            className={`segmented-option ${view === 'prezentare' ? 'active' : ''}`}
            onClick={() => setView('prezentare')}
          >
            Prezentare
          </button>
          <button
            type="button"
            className={`segmented-option ${view === 'devize' ? 'active' : ''}`}
            onClick={() => setView('devize')}
          >
            Devize
          </button>
        </div>
      </div>

      {view === 'prezentare' && <FinanciarPrezentare onOpenLucrare={onOpenLucrare} />}
      {view === 'devize' && <DevizePage onOpenLucrare={onOpenLucrare} />}
    </div>
  )
}
