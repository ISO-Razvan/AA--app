import { useMemo } from 'react'
import { formatSuma } from './SalariiPage.jsx'
import './modal-base.css'
import './SalariiDetaliuModal.css'

// `randuri` = etapele FINALIZATE ale tehnicianului în luna selectată (filtrate
// în SalariiPage), sortate descrescător după data finalizării — fiecare cu
// lucrarea, etapa și suma comisionului din instantaneul lucrării.
export default function SalariiDetaliuModal({ tehnician, lunaLabel, randuri, onClose, onOpenLucrare }) {
  // Sus: o secțiune per etapă (în ordinea din Setup), iar în ea grupuri pe
  // tip de lucrare. Fiecare rând e o etapă distinctă a unei lucrări, deci
  // elementele se adună o dată per lucrare în grup.
  const sectiuni = useMemo(() => {
    const map = new Map()
    for (const { lucrare, etapa, suma } of randuri) {
      const cheieEtapa = etapa?.id ?? ''
      if (!map.has(cheieEtapa)) {
        map.set(cheieEtapa, { cheie: cheieEtapa, nume: etapa?.nume || '—', ordine: etapa?.ordine ?? Infinity, tipuri: new Map() })
      }
      const tipuri = map.get(cheieEtapa).tipuri
      const tip = lucrare.tip_lucrare || '—'
      if (!tipuri.has(tip)) tipuri.set(tip, { tip, elemente: 0, comision: 0 })
      const g = tipuri.get(tip)
      g.elemente += Number(lucrare.nr_elemente) || 0
      g.comision += suma
    }
    return [...map.values()]
      .sort((a, b) => a.ordine - b.ordine)
      .map((s) => {
        const tipuri = [...s.tipuri.values()].sort((a, b) => a.tip.localeCompare(b.tip, 'ro'))
        return {
          ...s,
          tipuri,
          elemente: tipuri.reduce((sum, g) => sum + g.elemente, 0),
          comision: tipuri.reduce((sum, g) => sum + g.comision, 0),
        }
      })
  }, [randuri])

  const totalElemente = sectiuni.reduce((s, sec) => s + sec.elemente, 0)
  const totalComision = sectiuni.reduce((s, sec) => s + sec.comision, 0)

  // Jos: o singură linie per lucrare, oricâte etape ar fi finalizat
  // tehnicianul pe ea în lună; `randuri` vine deja cu cea mai recentă sus.
  const lucrariUnice = useMemo(() => {
    const vazute = new Set()
    const rezultat = []
    for (const { lucrare } of randuri) {
      if (vazute.has(lucrare.id)) continue
      vazute.add(lucrare.id)
      rezultat.push(lucrare)
    }
    return rezultat
  }, [randuri])

  const handleRowClick = (lucrare) => {
    onClose()
    onOpenLucrare(lucrare)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="salarii-detaliu-modal" role="dialog" aria-modal="true" aria-label={`Detalii salariu ${tehnician.nume}`}>
        <header className="salarii-detaliu-header">
          <div>
            <h2>{tehnician.nume}</h2>
            <p className="salarii-detaliu-luna">{lunaLabel}</p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Închide">
            ✕
          </button>
        </header>

        <div className="salarii-detaliu-body">
          {randuri.length === 0 ? (
            <p className="salarii-status-text">Nicio etapă finalizată în această lună.</p>
          ) : (
            <>
              <section>
                <h3 className="salarii-detaliu-sectiune">Pe etapă și tip de lucrare</h3>
                <table className="salarii-detaliu-tabel">
                  <thead>
                    <tr>
                      <th>Tip lucrare</th>
                      <th className="salarii-detaliu-num">Elemente</th>
                      <th className="salarii-detaliu-num">Comision</th>
                    </tr>
                  </thead>
                  {sectiuni.map((sec) => (
                    <tbody key={sec.cheie} className="salarii-detaliu-etapa-sectiune">
                      <tr className="salarii-detaliu-etapa-titlu">
                        <td colSpan={3}>{sec.nume}</td>
                      </tr>
                      {sec.tipuri.map((g) => (
                        <tr key={g.tip}>
                          <td className="salarii-detaliu-tip">{g.tip}</td>
                          <td className="salarii-detaliu-num">{g.elemente}</td>
                          <td className="salarii-detaliu-num">{formatSuma(g.comision)}</td>
                        </tr>
                      ))}
                      <tr className="salarii-detaliu-subtotal">
                        <td>Subtotal {sec.nume}</td>
                        <td className="salarii-detaliu-num">{sec.elemente}</td>
                        <td className="salarii-detaliu-num">{formatSuma(sec.comision)}</td>
                      </tr>
                    </tbody>
                  ))}
                  <tfoot>
                    <tr className="salarii-detaliu-total-row">
                      <td>Total</td>
                      <td className="salarii-detaliu-num">{totalElemente}</td>
                      <td className="salarii-detaliu-num">{formatSuma(totalComision)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section>
                <h3 className="salarii-detaliu-sectiune">Lucrări ({lucrariUnice.length})</h3>
                <table className="salarii-detaliu-tabel salarii-detaliu-tabel-lucrari">
                  <thead>
                    <tr>
                      <th>Medic</th>
                      <th>Pacient</th>
                      <th>Tip lucrare</th>
                      <th className="salarii-detaliu-num">Nr. elemente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lucrariUnice.map((l) => (
                      <tr
                        key={l.id}
                        className="salarii-detaliu-rand-lucrare"
                        onClick={() => handleRowClick(l)}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(l) }}
                        title={`${l.nr_inregistrare} — deschide fișa`}
                      >
                        <td>{l.medic || '—'}</td>
                        <td>{l.pacient || '—'}</td>
                        <td>{l.tip_lucrare || '—'}</td>
                        <td className="salarii-detaliu-num">{l.nr_elemente ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
