import { useEffect, useState } from 'react'
import EtapeProductieList from './EtapeProductieList.jsx'
import TehnicieniList from './TehnicieniList.jsx'
import TipuriLucrareCosturi from './TipuriLucrareCosturi.jsx'
import ExtraUriSetup from './ExtraUriSetup.jsx'
import ComisioaneGrid from './ComisioaneGrid.jsx'
import DateTestSection from './DateTestSection.jsx'
import './SetupPage.css'

const SECTIUNI = [
  { id: 'setup-etape', label: 'Etape de producție' },
  { id: 'setup-tehnicieni', label: 'Tehnicieni' },
  { id: 'setup-tipuri', label: 'Tipuri de lucrare' },
  { id: 'setup-extra', label: 'Extra-uri' },
  { id: 'setup-comisioane', label: 'Comisioane' },
]

export default function SetupPage() {
  const [etapeRefreshSignal, setEtapeRefreshSignal] = useState(0)
  const [tipuriRefreshSignal, setTipuriRefreshSignal] = useState(0)
  const [sectiuneActiva, setSectiuneActiva] = useState(SECTIUNI[0].id)

  // Scroll-spy: ancora activă e prima secțiune aflată sub bara de
  // sub-navigare (rootMargin negativ sus îngustează fereastra de detecție
  // la o bandă subțire chiar sub bară, ca să nu rămână „blocată" pe o
  // secțiune care a ieșit deja din ecran).
  useEffect(() => {
    const elemente = SECTIUNI.map((s) => document.getElementById(s.id)).filter(Boolean)
    if (elemente.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const vizibile = entries.filter((e) => e.isIntersecting)
        if (vizibile.length > 0) {
          setSectiuneActiva(vizibile[0].target.id)
        }
      },
      { rootMargin: '-120px 0px -70% 0px', threshold: 0 }
    )
    elemente.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const navigheazaLa = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="setup-page">
      <h2>Setup</h2>
      <p className="setup-page-hint">Configurări generale ale aplicației.</p>

      <nav className="setup-subnav" aria-label="Secțiuni Setup">
        {SECTIUNI.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`setup-subnav-item ${sectiuneActiva === s.id ? 'active' : ''}`}
            onClick={() => navigheazaLa(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <section id="setup-etape" className="setup-section">
        <EtapeProductieList onChange={() => setEtapeRefreshSignal((v) => v + 1)} />
      </section>
      <section id="setup-tehnicieni" className="setup-section">
        <TehnicieniList etapeRefreshSignal={etapeRefreshSignal} />
      </section>
      <section id="setup-tipuri" className="setup-section">
        <TipuriLucrareCosturi onChange={() => setTipuriRefreshSignal((v) => v + 1)} />
      </section>
      <section id="setup-extra" className="setup-section">
        <ExtraUriSetup />
      </section>
      <section id="setup-comisioane" className="setup-section">
        <ComisioaneGrid etapeRefreshSignal={etapeRefreshSignal} tipuriRefreshSignal={tipuriRefreshSignal} />
      </section>

      <DateTestSection />
    </div>
  )
}
