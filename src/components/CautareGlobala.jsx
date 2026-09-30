import { useEffect, useMemo, useRef, useState } from 'react'
import { getEtapeProductie, getToateAlocarile } from '../services/dataService'
import { subscribeToTable } from '../services/realtime'
import { statusDinRanduri } from '../utils/statusLucrare'
import './CautareGlobala.css'

const MIN_CARACTERE = 2
const MAX_REZULTATE = 8

function potrivire(l, query) {
  const haystack = [l.nr_inregistrare, l.pacient, l.medic, l.clinica].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

// Căutare globală în header — după nr. înregistrare, pacient, medic, clinică.
// Nu atinge căutarea locală din Listă lucrări; deschiderea fișei o face părintele.
export default function CautareGlobala({ lucrari, onSelect }) {
  const [query, setQuery] = useState('')
  const [deschis, setDeschis] = useState(false)
  const [activ, setActiv] = useState(0)
  const [totalEtape, setTotalEtape] = useState(0)
  const [alocari, setAlocari] = useState([])
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let montat = true
    Promise.all([getEtapeProductie(), getToateAlocarile()]).then(([etape, toate]) => {
      if (!montat) return
      setTotalEtape(etape.length)
      setAlocari(toate)
    })
    const unsubscribe = subscribeToTable('productie_lucrare', async () => {
      const toate = await getToateAlocarile()
      if (montat) setAlocari(toate)
    })
    return () => {
      montat = false
      unsubscribe()
    }
  }, [])

  const q = query.trim().toLowerCase()
  const rezultate = useMemo(() => {
    if (q.length < MIN_CARACTERE) return []
    return lucrari.filter((l) => potrivire(l, q)).slice(0, MAX_REZULTATE)
  }, [lucrari, q])

  useEffect(() => {
    setActiv(0)
  }, [q])

  useEffect(() => {
    if (!deschis) return
    const inchideLaClickAfara = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setDeschis(false)
    }
    document.addEventListener('mousedown', inchideLaClickAfara)
    return () => document.removeEventListener('mousedown', inchideLaClickAfara)
  }, [deschis])

  const statusPentru = (lucrareId) =>
    statusDinRanduri(totalEtape, alocari.filter((a) => a.lucrare_id === lucrareId))

  const reseteaza = () => {
    setQuery('')
    setDeschis(false)
  }

  const alege = (lucrare) => {
    reseteaza()
    inputRef.current?.blur()
    onSelect(lucrare)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      reseteaza()
      inputRef.current?.blur()
    } else if (e.key === 'ArrowDown' && rezultate.length > 0) {
      e.preventDefault()
      setActiv((i) => (i + 1) % rezultate.length)
    } else if (e.key === 'ArrowUp' && rezultate.length > 0) {
      e.preventDefault()
      setActiv((i) => (i - 1 + rezultate.length) % rezultate.length)
    } else if (e.key === 'Enter' && rezultate[activ]) {
      e.preventDefault()
      alege(rezultate[activ])
    }
  }

  const arataDropdown = deschis && q.length >= MIN_CARACTERE

  return (
    <div className="cautare-globala" ref={containerRef}>
      <input
        ref={inputRef}
        type="search"
        className="cautare-globala-input"
        placeholder="Caută lucrare: nr. înreg., pacient, medic, clinică…"
        aria-label="Căutare globală lucrări"
        aria-expanded={arataDropdown}
        aria-controls="cautare-globala-rezultate"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setDeschis(true)
        }}
        onFocus={() => setDeschis(true)}
        onKeyDown={onKeyDown}
      />
      {arataDropdown && (
        <ul className="cautare-globala-dropdown" id="cautare-globala-rezultate" role="listbox">
          {rezultate.length === 0 ? (
            <li className="cautare-globala-gol">Nicio lucrare găsită.</li>
          ) : (
            rezultate.map((l, i) => {
              const status = statusPentru(l.id)
              return (
                <li key={l.id} role="option" aria-selected={i === activ}>
                  <button
                    type="button"
                    className={`cautare-globala-rezultat ${i === activ ? 'activ' : ''}`}
                    onMouseEnter={() => setActiv(i)}
                    onClick={() => alege(l)}
                  >
                    <span className="cautare-globala-pacient">{l.pacient || '—'}</span>
                    <span className="cautare-globala-detalii">
                      {[l.medic, l.clinica].filter(Boolean).join(' · ') || '—'}
                      <span className="cautare-globala-nr"> · {l.nr_inregistrare}</span>
                    </span>
                    <span className="cautare-globala-badges">
                      {l.arhivat && <span className="badge badge-neutral">Arhivată</span>}
                      <span className={`badge ${status.badgeClass}`}>{status.label}</span>
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
