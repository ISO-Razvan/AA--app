import { useMemo, useState } from 'react'
import { facutePeZi, textTotal, zileSaptamanii } from '../utils/facuteSaptamana'
import './FacuteSaptamana.css'

const NUME_ZILE = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

function formatZiScurt(iso) {
  const [, l, z] = iso.split('-').map(Number)
  return `${z}.${String(l).padStart(2, '0')}`
}

function formatInterval(zile) {
  const luna = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })
  return `${luna(zile[0])} – ${luna(zile[6])}`
}

// „Făcute în săptămâna asta": lucrările pe care tehnicianul ales le-a finalizat, pe zile
// (luni–duminică), după DATA FINALIZĂRII. Doar ale lui, cu navigare pe săptămâni.
// `alocari` poate conține rânduri ale altor tehnicieni (pagina Task-uri le are pe toate):
// se iau doar cele cu tehnician_id = `tehnicianId`. `lucrari` trebuie să includă și
// lucrările arhivate (cele finalizate se arhivează la deviz, dar rămân în istoric).
export default function FacuteSaptamana({ tehnicianId, alocari, lucrari, etape, astazi, onOpenLucrare }) {
  const [offset, setOffset] = useState(0)
  const zile = useMemo(() => zileSaptamanii(astazi, offset), [astazi, offset])
  const peZi = useMemo(
    () => facutePeZi({ alocari, lucrari, etape, tehnicianId, zile }),
    [alocari, lucrari, etape, tehnicianId, zile]
  )
  const totalSaptamana = zile.reduce((n, zi) => n + peZi[zi].length, 0)

  return (
    <section className="card facute-saptamana" aria-label="Făcute în săptămâna asta">
      <header className="facute-antet">
        <h3 className="taskuri-panel-title">
          {offset === 0 ? 'Făcute în săptămâna asta' : 'Făcute în săptămâna aleasă'}
          <span className="taskuri-casete-nr">{totalSaptamana}</span>
        </h3>
        <div className="facute-nav">
          <button type="button" className="btn btn-secondary taskuri-week-btn" onClick={() => setOffset((v) => v - 1)} aria-label="Săptămâna precedentă">
            ←
          </button>
          <span className="facute-eticheta">{formatInterval(zile)}</span>
          <button type="button" className="btn btn-secondary taskuri-week-btn" onClick={() => setOffset((v) => v + 1)} aria-label="Săptămâna următoare">
            →
          </button>
          {offset !== 0 && (
            <button type="button" className="btn btn-ghost taskuri-week-today" onClick={() => setOffset(0)}>
              Azi
            </button>
          )}
        </div>
      </header>

      <div className="facute-grid">
        {zile.map((zi, i) => {
          const lista = peZi[zi]
          return (
            <div key={zi} className={`facute-zi ${zi === astazi ? 'facute-zi-azi' : ''}`}>
              <div className="facute-zi-antet">
                <span className="facute-zi-nume">{NUME_ZILE[i]}</span>
                <span className="facute-zi-data">{formatZiScurt(zi)}</span>
              </div>
              <div className="facute-zi-corp">
                {lista.length === 0 ? (
                  <p className="facute-gol">—</p>
                ) : (
                  lista.map(({ alocare, lucrare, etapa }) => (
                    <button
                      key={alocare.id || `${lucrare.id}-${alocare.etapa_id}`}
                      type="button"
                      className="facute-caseta"
                      onClick={() => onOpenLucrare(lucrare)}
                      title={`${lucrare.nr_inregistrare} · ${lucrare.pacient || '—'}\n${lucrare.tip_lucrare || '—'}${etapa ? `\nEtapa: ${etapa.nume}` : ''}`}
                    >
                      <span className="facute-caseta-nr">{lucrare.nr_inregistrare}</span>
                      <span className="facute-caseta-pacient rezumat-pacient">{lucrare.pacient || '—'}</span>
                      <span className="facute-caseta-tip">{lucrare.tip_lucrare || '—'}</span>
                      {etapa && <span className="facute-caseta-etapa">{etapa.nume}</span>}
                    </button>
                  ))
                )}
              </div>
              {lista.length > 0 && <div className="facute-zi-total">{textTotal(lista.length)}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
