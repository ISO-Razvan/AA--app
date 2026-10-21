import { useEffect, useState } from 'react'
import EtapeProductieList from './EtapeProductieList.jsx'
import TehnicieniList from './TehnicieniList.jsx'
import TipuriLucrareCosturi from './TipuriLucrareCosturi.jsx'
import ExtraUriSetup from './ExtraUriSetup.jsx'
import ComisioaneGrid from './ComisioaneGrid.jsx'
import AdaosuriDesignSetup from './AdaosuriDesignSetup.jsx'
import DateTestSection from './DateTestSection.jsx'
import MediciSetup from './MediciSetup.jsx'
import NoteSetup from './NoteSetup.jsx'
import { estePatron } from '../utils/roluri'
import './SetupPage.css'

// Secțiunile cu prețuri și sume (`doarPatron`) nu apar pentru coordonator.
const SECTIUNI = [
  { id: 'setup-etape', label: 'Etape de producție' },
  { id: 'setup-tehnicieni', label: 'Tehnicieni' },
  { id: 'setup-medici', label: 'Medici' },
  { id: 'setup-note', label: 'Note' },
  { id: 'setup-tipuri', label: 'Tipuri de lucrare', doarPatron: true },
  { id: 'setup-extra', label: 'Extra-uri', doarPatron: true },
  { id: 'setup-comisioane', label: 'Comisioane', doarPatron: true },
  { id: 'setup-adaosuri', label: 'Adaosuri Design', doarPatron: true },
]

export default function SetupPage({ profile, onDataChanged }) {
  const patron = estePatron(profile)
  const sectiuni = SECTIUNI.filter((s) => patron || !s.doarPatron)
  const [etapeRefreshSignal, setEtapeRefreshSignal] = useState(0)
  const [tipuriRefreshSignal, setTipuriRefreshSignal] = useState(0)
  const [sectiuneActiva, setSectiuneActiva] = useState(SECTIUNI[0].id)

  // Scroll-spy: ancora activă e prima secțiune aflată sub bara de
  // sub-navigare (rootMargin negativ sus îngustează fereastra de detecție
  // la o bandă subțire chiar sub bară, ca să nu rămână „blocată" pe o
  // secțiune care a ieșit deja din ecran).
  useEffect(() => {
    const elemente = sectiuni.map((s) => document.getElementById(s.id)).filter(Boolean)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patron])

  const navigheazaLa = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="setup-page">
      <h2>Setup</h2>
      <p className="setup-page-hint">Configurări generale ale aplicației.</p>

      <nav className="setup-subnav" aria-label="Secțiuni Setup">
        {sectiuni.map((s) => (
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
        <TehnicieniList etapeRefreshSignal={etapeRefreshSignal} gestioneazaConturi={patron} />
      </section>
      <section id="setup-medici" className="setup-section">
        <MediciSetup />
      </section>
      <section id="setup-note" className="setup-section">
        <NoteSetup />
      </section>
      {patron && (
        <>
          <section id="setup-tipuri" className="setup-section">
            <TipuriLucrareCosturi onChange={() => setTipuriRefreshSignal((v) => v + 1)} />
          </section>
          <section id="setup-extra" className="setup-section">
            <ExtraUriSetup />
          </section>
          <section id="setup-comisioane" className="setup-section">
            <ComisioaneGrid etapeRefreshSignal={etapeRefreshSignal} tipuriRefreshSignal={tipuriRefreshSignal} />
          </section>
          <section id="setup-adaosuri" className="setup-section">
            <AdaosuriDesignSetup />
          </section>
        </>
      )}

      <DateTestSection profile={profile} onDataChanged={onDataChanged} />
    </div>
  )
}
