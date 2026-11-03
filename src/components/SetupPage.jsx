import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { estePatron } from '../utils/roluri'
import { GRUPURI_SETUP, SECTIUNI_SETUP } from './setup/sectiuniSetup.jsx'
import './SetupPage.css'

// Ultima secțiune folosită — /setup te duce direct acolo.
const CHEIE_ULTIMA_SECTIUNE = 'setup-ultima-sectiune'

function citesteUltimaSectiune() {
  try {
    return localStorage.getItem(CHEIE_ULTIMA_SECTIUNE)
  } catch {
    return null
  }
}

function salveazaUltimaSectiune(slug) {
  try {
    localStorage.setItem(CHEIE_ULTIMA_SECTIUNE, slug)
  } catch {
    // Fără spațiu de stocare (mod privat etc.): meniul merge, doar nu ține minte secțiunea.
  }
}

// Setup: meniu pe grupuri în stânga (taburi sus sub ~900px) și, în dreapta, câte
// o singură secțiune, cu ruta ei (/setup/<secțiune>). Secțiunile în sine sunt
// componentele de până acum, neschimbate — vezi setup/sectiuniSetup.jsx.
export default function SetupPage({ profile, onDataChanged }) {
  const patron = estePatron(profile)
  const { pathname } = useLocation()
  const sectiuni = useMemo(() => SECTIUNI_SETUP.filter((s) => patron || !s.doarPatron), [patron])
  const slug = pathname.split('/')[2] || ''
  const activa = sectiuni.find((s) => s.slug === slug) || null

  // O secțiune care și-a schimbat datele anunță secțiunile care depind de ele
  // (Tehnicieni și Comisioane de etape, Comisioane de tipuri de lucrare).
  const [etapeRefreshSignal, setEtapeRefreshSignal] = useState(0)
  const [tipuriRefreshSignal, setTipuriRefreshSignal] = useState(0)
  const semnale = useMemo(
    () => ({
      etape: etapeRefreshSignal,
      tipuri: tipuriRefreshSignal,
      etapeSchimbate: () => setEtapeRefreshSignal((v) => v + 1),
      tipuriSchimbate: () => setTipuriRefreshSignal((v) => v + 1),
    }),
    [etapeRefreshSignal, tipuriRefreshSignal]
  )

  // Numărul de elemente din fiecare secțiune, afișat în meniu (citire simplă;
  // dacă o citire eșuează, intrarea rămâne fără număr).
  const [numere, setNumere] = useState({})
  const montat = useRef(true)
  const timer = useRef(null)
  useEffect(() => {
    montat.current = true
    return () => {
      montat.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const incarcaNumere = useCallback(async () => {
    const perechi = await Promise.all(
      sectiuni.map(async (s) => {
        try {
          return [s.slug, s.numar ? await s.numar() : null]
        } catch {
          return [s.slug, null]
        }
      })
    )
    if (montat.current) setNumere(Object.fromEntries(perechi.filter(([, n]) => n != null)))
  }, [sectiuni])

  // La schimbarea secțiunii și la scurt timp după orice acțiune din secțiune
  // (clic, trimitere, ieșire din câmp), ca numerele din meniu să rămână la zi.
  useEffect(() => {
    incarcaNumere()
  }, [incarcaNumere, activa?.slug])

  const programeazaReincarcarea = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(incarcaNumere, 1000)
  }, [incarcaNumere])

  useEffect(() => {
    if (!activa) return
    salveazaUltimaSectiune(activa.slug)
    window.scrollTo({ top: 0 })
  }, [activa])

  if (!activa) {
    const ultima = sectiuni.find((s) => s.slug === citesteUltimaSectiune()) || sectiuni[0]
    return <Navigate to={`/setup/${ultima.slug}`} replace />
  }

  const ctx = { profile, patron, onDataChanged, semnale }

  return (
    <div className="setup-page">
      <h2>Setup</h2>

      <div className="setup-layout">
        <nav className="setup-meniu" aria-label="Secțiuni Setup">
          {GRUPURI_SETUP.map((grup) => {
            const intrari = sectiuni.filter((s) => s.grup === grup)
            if (intrari.length === 0) return null
            return (
              <div className="setup-meniu-grup" key={grup}>
                <p className="setup-meniu-titlu">{grup}</p>
                {intrari.map((s) => (
                  <Link
                    key={s.slug}
                    to={`/setup/${s.slug}`}
                    className={`setup-meniu-item ${s.slug === activa.slug ? 'active' : ''}`}
                    aria-current={s.slug === activa.slug ? 'page' : undefined}
                  >
                    <span>{s.label}</span>
                    {numere[s.slug] != null && <span className="setup-meniu-nr">{numere[s.slug]}</span>}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="setup-continut" onClickCapture={programeazaReincarcarea} onSubmit={programeazaReincarcarea} onBlur={programeazaReincarcarea}>
          <section key={activa.slug} className="setup-section">
            {activa.randare(ctx)}
          </section>
        </div>
      </div>
    </div>
  )
}
