import { createContext, Fragment, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ajutorPentru } from './continut'
import { rolul } from '../utils/roluri'
import './Ajutor.css'

// Rolul utilizatorului logat, pentru a alege textul potrivit (vezi continut.js).
const AjutorContext = createContext(null)

export function AjutorProvider({ profile, children }) {
  return <AjutorContext.Provider value={rolul(profile)}>{children}</AjutorContext.Provider>
}

export const useRolAjutor = () => useContext(AjutorContext)

// **text** → <strong>, *text* → <em>.
function TextFormatat({ text }) {
  const parti = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parti.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>
    return <Fragment key={i}>{p}</Fragment>
  })
}

function Lista({ elemente, numerotata }) {
  const Tag = numerotata ? 'ol' : 'ul'
  return (
    <Tag className="ajutor-lista">
      {elemente.map((e, i) => (
        <li key={i}>
          <TextFormatat text={typeof e === 'string' ? e : e.text} />
          {/* typeof: un string are și el o metodă (veche) `.sub` */}
          {typeof e === 'object' && Array.isArray(e.sub) && (
            <ul className="ajutor-lista">
              {e.sub.map((s, j) => (
                <li key={j}>
                  <TextFormatat text={s} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </Tag>
  )
}

// Conținutul unei secțiuni de ajutor — folosit în panou și în pagina Ghid.
export function ContinutAjutor({ intrare }) {
  return (
    <div className="ajutor-continut">
      {intrare.la && (
        <p className="ajutor-la">
          <TextFormatat text={intrare.la} />
        </p>
      )}
      {intrare.pasi?.length > 0 && (
        <>
          <h4 className="ajutor-subtitlu">Pași</h4>
          <Lista elemente={intrare.pasi} numerotata />
        </>
      )}
      {intrare.atentie?.length > 0 && (
        <>
          <h4 className="ajutor-subtitlu ajutor-subtitlu-atentie">Atenție</h4>
          <Lista elemente={intrare.atentie} />
        </>
      )}
    </div>
  )
}

function PanouAjutor({ intrare, onClose }) {
  useEffect(() => {
    const laTasta = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', laTasta)
    return () => window.removeEventListener('keydown', laTasta)
  }, [onClose])

  return createPortal(
    <div className="ajutor-fundal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="ajutor-panou" role="dialog" aria-modal="true" aria-label={`Ajutor: ${intrare.titlu}`}>
        <header className="ajutor-panou-antet">
          <h3>{intrare.titlu}</h3>
          <button type="button" className="btn btn-ghost ajutor-inchide" onClick={onClose} aria-label="Închide ajutorul">
            ✕
          </button>
        </header>
        <div className="ajutor-panou-corp">
          <ContinutAjutor intrare={intrare} />
        </div>
      </aside>
    </div>,
    document.body
  )
}

// Butonul „?" — deschide instrucțiunea paginii `id` pentru rolul logat.
// Nu apare deloc dacă nu există text pentru pagina și rolul respectiv.
// `rol` explicit — pentru pagina medicului (în afara AjutorProvider).
export function AjutorButon({ id, rol: rolExplicit, className = '' }) {
  const rolContext = useRolAjutor()
  const [deschis, setDeschis] = useState(false)
  const intrare = ajutorPentru(id, rolExplicit || rolContext)
  if (!intrare) return null
  return (
    <>
      <button
        type="button"
        className={`ajutor-buton ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          setDeschis(true)
        }}
        aria-label={`Ajutor: ${intrare.titlu}`}
        title="Cum se folosește"
      >
        ?
      </button>
      {deschis && <PanouAjutor intrare={intrare} onClose={() => setDeschis(false)} />}
    </>
  )
}

// Titlu de pagină cu butonul „?" alături.
export function TitluCuAjutor({ id, children, as: Tag = 'h2', className = '' }) {
  return (
    <div className={`ajutor-titlu ${className}`}>
      <Tag>{children}</Tag>
      <AjutorButon id={id} />
    </div>
  )
}
