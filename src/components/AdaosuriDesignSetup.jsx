import { useEffect, useState } from 'react'
import { getSetariSalarii, updateSetariSalarii } from '../services/dataService'
import './AdaosuriDesignSetup.css'

const CAMPURI = [
  {
    cheie: 'adaos_implant',
    eticheta: 'Implant (per element simplu)',
    ajutor: 'RON pentru fiecare element simplu (fără punte) marcat pe implant. Nu se aplică la lucrările All-on.',
  },
  {
    cheie: 'adaos_thimble',
    eticheta: 'Thimble (per element, All-on)',
    ajutor: 'RON pentru fiecare thimble — câte unul pe element, la tipurile de lucrare marcate All-on.',
  },
  {
    cheie: 'adaos_model_printat',
    eticheta: 'Model printat (per comandă)',
    ajutor: 'RON o singură dată pe comandă, când Modelul este „Print”.',
  },
]

export default function AdaosuriDesignSetup() {
  const [valori, setValori] = useState(null)
  const [eroare, setEroare] = useState('')
  const [salvat, setSalvat] = useState(false)

  useEffect(() => {
    getSetariSalarii()
      .then(setValori)
      .catch((err) => setEroare(err.message))
  }, [])

  const handleBlur = async () => {
    setEroare('')
    setSalvat(false)
    try {
      await updateSetariSalarii(valori)
      setSalvat(true)
    } catch (err) {
      setEroare(err.message)
    }
  }

  return (
    <div className="card adaosuri-card">
      <div className="adaosuri-header">
        <h3>Adaosuri Design</h3>
        <p>
          Sume adăugate la salariul tehnicianului alocat pe etapa Design a lucrării, peste comisionul normal. Se copiază
          pe fiecare lucrare la înregistrare (ca și comisioanele) — modificările se aplică lucrărilor noi; pentru cele
          existente folosește „Recalculează valorile financiare” din Tipuri de lucrare. Bifa „All-on” se pune pe
          fiecare tip de lucrare în parte.
        </p>
      </div>

      {!valori ? (
        <p className="adaosuri-loading">{eroare || 'Se încarcă…'}</p>
      ) : (
        <div className="adaosuri-campuri">
          {CAMPURI.map((c) => (
            <label key={c.cheie} className="adaosuri-camp">
              <span className="adaosuri-eticheta">{c.eticheta}</span>
              <span className="adaosuri-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="text-input adaosuri-input"
                  value={valori[c.cheie]}
                  onChange={(e) => {
                    setSalvat(false)
                    setValori((prev) => ({ ...prev, [c.cheie]: e.target.value }))
                  }}
                  onBlur={handleBlur}
                />
                <span className="adaosuri-unitate">lei</span>
              </span>
              <span className="adaosuri-ajutor">{c.ajutor}</span>
            </label>
          ))}
        </div>
      )}
      {valori && salvat && <p className="adaosuri-salvat">Salvat.</p>}
      {valori && eroare && <p className="adaosuri-eroare">{eroare}</p>}
    </div>
  )
}
