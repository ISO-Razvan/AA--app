import { useEffect } from 'react'
import { ghidPentru } from '../ajutor/continut'
import { ContinutAjutor, useRolAjutor } from '../ajutor/Ajutor.jsx'
import './GhidPage.css'

// Ghidul de utilizare — aceleași texte ca butoanele „?", adunate pe o pagină
// (ghidul general + fiecare pagină), doar cele pentru rolul logat. Se poate
// tipări sau salva ca PDF (stilurile de tipărire ascund meniul).
export default function GhidPage() {
  const rol = useRolAjutor()
  const { general, pagini } = ghidPentru(rol)

  useEffect(() => {
    document.body.classList.add('ghid-activ')
    return () => document.body.classList.remove('ghid-activ')
  }, [])

  const sectiune = (s) => (
    <section key={`${s.id}-${s.roluri.join()}`} id={`ghid-${s.id}`} className="card ghid-sectiune">
      <h3>{s.titlu}</h3>
      <ContinutAjutor intrare={s} />
    </section>
  )

  return (
    <div className="ghid">
      <div className="ghid-antet">
        <div>
          <h2>Ghid de utilizare</h2>
          <p className="ghid-hint">
            Aceleași instrucțiuni le găsești pe fiecare pagină, la butonul <span className="ghid-semn">?</span> de lângă titlu.
          </p>
        </div>
        <button type="button" className="btn btn-secondary ghid-actiuni" onClick={() => window.print()}>
          Tipărește / salvează PDF
        </button>
      </div>

      <nav className="card ghid-cuprins" aria-label="Cuprins">
        <h4>Cuprins</h4>
        <ol>
          {[...general, ...pagini].map((s) => (
            <li key={`${s.id}-${s.roluri.join()}`}>
              <a
                href={`#ghid-${s.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(`ghid-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {s.titlu}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {general.length > 0 && (
        <>
          <h3 className="ghid-grup">Pe scurt</h3>
          {general.map(sectiune)}
        </>
      )}
      <h3 className="ghid-grup">Pagină cu pagină</h3>
      {pagini.map(sectiune)}
    </div>
  )
}
