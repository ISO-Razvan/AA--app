import { useEffect, useState } from 'react'
import { getEtapeProductie, getTipuriLucrareDetaliate, getComisioane, setComisiune } from '../services/dataService'
import './ComisioaneGrid.css'

export default function ComisioaneGrid({ etapeRefreshSignal, tipuriRefreshSignal }) {
  const [etape, setEtape] = useState([])
  const [tipuri, setTipuri] = useState([])
  const [comisioane, setComisioane] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [e, t, c] = await Promise.all([getEtapeProductie(), getTipuriLucrareDetaliate(), getComisioane()])
    setEtape(e)
    setTipuri(t)
    setComisioane(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapeRefreshSignal, tipuriRefreshSignal])

  const sumaFor = (tipNume, etapaId) => {
    const rand = comisioane.find((c) => c.tip_lucrare === tipNume && c.etapa_id === etapaId)
    return rand ? rand.suma : 0
  }

  const handleChange = (tipNume, etapaId, valoare) => {
    setComisioane((prev) => {
      const idx = prev.findIndex((c) => c.tip_lucrare === tipNume && c.etapa_id === etapaId)
      const suma = valoare === '' ? 0 : Number(valoare)
      if (idx === -1) return [...prev, { tip_lucrare: tipNume, etapa_id: etapaId, suma }]
      const next = [...prev]
      next[idx] = { ...next[idx], suma }
      return next
    })
  }

  const handleBlur = async (tipNume, etapaId, valoare) => {
    await setComisiune(tipNume, etapaId, valoare === '' ? 0 : Number(valoare))
  }

  return (
    <div className="card comisioane-card">
      <div className="comisioane-header">
        <h3>Comisioane</h3>
        <p>Sumă fixă per etapă de producție, diferită pe tip de lucrare. Modificările se aplică doar lucrărilor înregistrate după salvare — cele existente păstrează valorile de la momentul înregistrării.</p>
      </div>

      {loading ? (
        <p className="comisioane-loading">Se încarcă…</p>
      ) : tipuri.length === 0 || etape.length === 0 ? (
        <p className="comisioane-empty">
          {etape.length === 0
            ? 'Definește mai întâi cel puțin o etapă de producție.'
            : 'Niciun tip de lucrare definit încă (se adaugă din formularul de înregistrare).'}
        </p>
      ) : (
        <div className="comisioane-table-wrap">
          <table className="comisioane-table">
            <thead>
              <tr>
                <th className="comisioane-th-tip">Tip lucrare</th>
                {etape.map((etapa) => (
                  <th key={etapa.id}>{etapa.nume}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tipuri.map((tip) => (
                <tr key={tip.id}>
                  <td className="comisioane-td-tip">{tip.nume}</td>
                  {etape.map((etapa) => (
                    <td key={etapa.id}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-input comisioane-input"
                        value={sumaFor(tip.nume, etapa.id)}
                        onChange={(e) => handleChange(tip.nume, etapa.id, e.target.value)}
                        onBlur={(e) => handleBlur(tip.nume, etapa.id, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
