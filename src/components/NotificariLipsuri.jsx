import { useEffect, useMemo, useRef, useState } from 'react'
import { getEtapeProductie, getToateAlocarile } from '../services/dataService'
import { subscribeToTable } from '../services/realtime'
import { lucrariCuLipsuri, textNotificare } from '../utils/informatiiLipsa'
import './NotificariLipsuri.css'

// Clopoțelul din header: câte lucrări nefinalizate au informații lipsă (vezi
// utils/informatiiLipsa.js pentru câmpuri). Lucrările vin din părinte (care e
// deja abonat la `lucrari`); etapele bifate se reiau la fiecare schimbare din
// `productie_lucrare`, ca o lucrare care se finalizează să iasă din listă singură.
export default function NotificariLipsuri({ lucrari, onOpenLucrare }) {
  const [deschis, setDeschis] = useState(false)
  const [etape, setEtape] = useState(null)
  const [alocari, setAlocari] = useState([])
  const radacinaRef = useRef(null)

  useEffect(() => {
    let montat = true
    Promise.all([getEtapeProductie(), getToateAlocarile()])
      .then(([etapeNoi, toate]) => {
        if (!montat) return
        setEtape(etapeNoi)
        setAlocari(toate)
      })
      .catch(() => {})
    const unsubscribe = subscribeToTable('productie_lucrare', async () => {
      try {
        const toate = await getToateAlocarile()
        if (montat) setAlocari(toate)
      } catch {
        // rămâne lista de dinainte
      }
    })
    return () => {
      montat = false
      unsubscribe()
    }
  }, [])

  // Până se știu etapele, nu se poate hotărî ce e finalizat — nu arătăm nimic.
  const intrari = useMemo(
    () => (etape == null ? [] : lucrariCuLipsuri({ lucrari, etape, alocari })),
    [lucrari, etape, alocari]
  )

  // Panoul se închide la clic în afară și la Escape.
  useEffect(() => {
    if (!deschis) return undefined
    const laClic = (e) => {
      if (radacinaRef.current && !radacinaRef.current.contains(e.target)) setDeschis(false)
    }
    const laTasta = (e) => {
      if (e.key === 'Escape') setDeschis(false)
    }
    document.addEventListener('mousedown', laClic)
    document.addEventListener('keydown', laTasta)
    return () => {
      document.removeEventListener('mousedown', laClic)
      document.removeEventListener('keydown', laTasta)
    }
  }, [deschis])

  const nr = intrari.length
  const eticheta = nr === 0 ? 'Notificări: nicio lucrare cu informații lipsă' : `Notificări: ${nr} ${nr === 1 ? 'lucrare' : 'lucrări'} cu informații lipsă`

  return (
    <div className="notificari" ref={radacinaRef}>
      <button
        type="button"
        className={`notificari-clopot ${deschis ? 'activ' : ''}`}
        onClick={() => setDeschis((v) => !v)}
        aria-label={eticheta}
        aria-expanded={deschis}
        aria-haspopup="true"
        title={eticheta}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 01-3.4 0" />
        </svg>
        {nr > 0 && <span className="notificari-badge">{nr > 99 ? '99+' : nr}</span>}
      </button>

      {deschis && (
        <div className="notificari-panou" role="dialog" aria-label="Lucrări cu informații lipsă">
          <p className="notificari-antet">Informații lipsă</p>
          {nr === 0 ? (
            <p className="notificari-gol">Nicio lucrare nefinalizată cu informații lipsă.</p>
          ) : (
            <ul className="notificari-lista">
              {intrari.map((intrare) => (
                <li key={intrare.lucrare.id}>
                  <button
                    type="button"
                    className="notificari-rand"
                    onClick={() => {
                      setDeschis(false)
                      onOpenLucrare(intrare.lucrare)
                    }}
                  >
                    {textNotificare(intrare)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
