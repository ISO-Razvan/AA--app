import { useEffect, useState } from 'react'
import { addLucrare, updateLucrare, getConfigList } from '../services/dataService'
import { lucrariDemo } from '../utils/demoData'
import StergeToateDialog from './StergeToateDialog.jsx'
import './DateTestSection.css'

// Generator de lucrări fictive, doar pentru testare — mutat aici (nu mai e
// vizibil în Listă lucrări) ca să nu fie apăsat din greșeală în timpul
// folosirii reale a aplicației. Tot aici, doar pentru admin: ștergerea
// tuturor lucrărilor.
export default function DateTestSection({ profile, onDataChanged }) {
  const [tipuriLucrareNume, setTipuriLucrareNume] = useState(null) // null = încă neîncărcat
  const [seeding, setSeeding] = useState(false)
  const [demoMessage, setDemoMessage] = useState('')
  const [stergereDeschisa, setStergereDeschisa] = useState(false)
  const esteAdmin = profile?.rol === 'admin'

  const handleStergereGata = async ({ lucrari, devize }) => {
    setStergereDeschisa(false)
    setDemoMessage(
      `${lucrari} ${lucrari === 1 ? 'lucrare' : 'lucrări'} și ${devize} ${devize === 1 ? 'deviz' : 'devize'} șterse, backup descărcat.`
    )
    await onDataChanged?.()
  }

  useEffect(() => {
    async function load() {
      setTipuriLucrareNume(await getConfigList('tipuri_lucrare'))
    }
    load()
  }, [])

  const handleSeedDemo = async () => {
    setSeeding(true)
    setDemoMessage('')
    try {
      const demo = lucrariDemo(tipuriLucrareNume)
      for (const { _nextDate, ...payload } of demo) {
        const lucrare = await addLucrare(payload)
        if (_nextDate) await updateLucrare(lucrare.id, { next_date: _nextDate })
      }
      setDemoMessage(`${demo.length} lucrări demo adăugate.`)
      await onDataChanged?.()
    } catch (err) {
      setDemoMessage(`Eroare la adăugarea datelor demo: ${err.message}`)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <section className="date-test-card">
      <h3 className="date-test-title">Date de test</h3>
      <p className="date-test-hint">
        Adaugă 10 lucrări fictive, utile doar pentru testare. Nu folosi în timpul lucrului real.
      </p>

      {tipuriLucrareNume?.length === 0 && (
        <p className="date-test-notice">
          Configurează cel puțin un tip de lucrare mai sus înainte de a genera date demo.
        </p>
      )}

      <div className="date-test-actions">
        <button
          type="button"
          className="btn btn-ghost date-test-btn"
          onClick={handleSeedDemo}
          disabled={seeding || tipuriLucrareNume?.length === 0}
        >
          {seeding ? 'Se adaugă…' : '+ 10 lucrări demo'}
        </button>
        {esteAdmin && (
          <button
            type="button"
            className="btn date-test-btn date-test-btn-danger"
            onClick={() => {
              setDemoMessage('')
              setStergereDeschisa(true)
            }}
            disabled={seeding}
          >
            Șterge toate lucrările
          </button>
        )}
      </div>

      {demoMessage && (
        <p className={`date-test-message ${demoMessage.startsWith('Eroare') ? 'warn' : ''}`}>{demoMessage}</p>
      )}

      {stergereDeschisa && (
        <StergeToateDialog onClose={() => setStergereDeschisa(false)} onDone={handleStergereGata} />
      )}
    </section>
  )
}
