import { useState } from 'react'
import EtapeProductieList from './EtapeProductieList.jsx'
import TehnicieniList from './TehnicieniList.jsx'
import TipuriLucrareCosturi from './TipuriLucrareCosturi.jsx'
import ComisioaneGrid from './ComisioaneGrid.jsx'
import './SetupPage.css'

export default function SetupPage() {
  const [etapeRefreshSignal, setEtapeRefreshSignal] = useState(0)
  const [tipuriRefreshSignal, setTipuriRefreshSignal] = useState(0)

  return (
    <div className="setup-page">
      <h2>Setup</h2>
      <p className="setup-page-hint">Configurări generale ale aplicației.</p>

      <EtapeProductieList onChange={() => setEtapeRefreshSignal((v) => v + 1)} />
      <TehnicieniList etapeRefreshSignal={etapeRefreshSignal} />
      <TipuriLucrareCosturi onChange={() => setTipuriRefreshSignal((v) => v + 1)} />
      <ComisioaneGrid etapeRefreshSignal={etapeRefreshSignal} tipuriRefreshSignal={tipuriRefreshSignal} />
    </div>
  )
}
