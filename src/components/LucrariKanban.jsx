import { useEffect, useState } from 'react'
import { getEtapeProductie, getToateAlocarile, getTehnicieni } from '../services/dataService'
import { azi, adaugaZile } from '../utils/date'
import { etapaCurentaPentru } from '../utils/etapaProductie'
import './LucrariKanban.css'

function formatData(dataStr) {
  if (!dataStr) return '—'
  const [an, luna, zi] = dataStr.split('-')
  if (!an || !luna || !zi) return dataStr
  return `${zi}.${luna}.${an}`
}

function initiale(nume) {
  if (!nume) return ''
  return nume
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const COLOANA_FINALIZAT = '__finalizat__'

export default function LucrariKanban({ lucrari, onRowClick }) {
  const [etape, setEtape] = useState([])
  const [alocari, setAlocari] = useState([])
  const [tehnicieni, setTehnicieni] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [e, a, t] = await Promise.all([getEtapeProductie(), getToateAlocarile(), getTehnicieni()])
      setEtape(e)
      setAlocari(a)
      setTehnicieni(t)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <p className="kanban-loading">Se încarcă…</p>
  }

  if (etape.length === 0) {
    return (
      <div className="card kanban-empty">
        <p>Nicio etapă de producție definită încă — adaugă etape din Setup → Etape de producție.</p>
      </div>
    )
  }

  const astazi = azi()
  const pragUrgent = adaugaZile(astazi, 2)

  const coloane = [
    ...etape.map((e) => ({ id: e.id, nume: e.nume })),
    { id: COLOANA_FINALIZAT, nume: 'Finalizat' },
  ]

  const grupuri = Object.fromEntries(coloane.map((c) => [c.id, []]))

  for (const l of lucrari) {
    const randuriLucrare = alocari.filter((a) => a.lucrare_id === l.id)
    const { etapa: etapaCurenta, rand: randCurent } = etapaCurentaPentru(etape, randuriLucrare)
    const coloanaId = etapaCurenta ? etapaCurenta.id : COLOANA_FINALIZAT
    grupuri[coloanaId].push({ lucrare: l, rand: randCurent })
  }

  const tehnicianById = (id) => tehnicieni.find((t) => t.id === id)

  return (
    <div className="kanban-board">
      {coloane.map((coloana) => {
        const carduri = grupuri[coloana.id] || []
        const finalizata = coloana.id === COLOANA_FINALIZAT
        return (
          <div className="kanban-column" key={coloana.id}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">{coloana.nume}</span>
              <span className="kanban-column-count">{carduri.length}</span>
            </div>

            <div className="kanban-column-body">
              {carduri.length === 0 && <p className="kanban-column-empty">—</p>}
              {carduri.map(({ lucrare, rand }) => {
                const tehnician = rand?.tehnician_id ? tehnicianById(rand.tehnician_id) : null
                const depasit = !finalizata && lucrare.termen_predare && lucrare.termen_predare < astazi
                const urgent = !finalizata && !depasit && lucrare.termen_predare && lucrare.termen_predare <= pragUrgent
                return (
                  <button
                    type="button"
                    key={lucrare.id}
                    className="kanban-card"
                    onClick={() => onRowClick(lucrare)}
                  >
                    <div className="kanban-card-top">
                      <span className="kanban-card-nr">{lucrare.nr_inregistrare}</span>
                      {tehnician && (
                        <span className="kanban-card-tehnician" title={tehnician.nume}>
                          {initiale(tehnician.nume)}
                        </span>
                      )}
                    </div>
                    <p className="kanban-card-tip">{lucrare.tip_lucrare}</p>
                    <p className="kanban-card-pacient">{lucrare.pacient || '—'}</p>
                    <span
                      className={`kanban-card-termen ${depasit ? 'kanban-card-termen-depasit' : ''} ${urgent ? 'kanban-card-termen-urgent' : ''}`}
                    >
                      {formatData(lucrare.termen_predare)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
