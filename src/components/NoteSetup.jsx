import { useCallback, useEffect, useState } from 'react'
import { getSubiecteNote, addSubiectNota, updateSubiectNota, getSetariNote, updateSetariNote } from '../services/dataService'
import './NoteSetup.css'

// Setup → Note: subiectele predefinite ale notelor pe comandă și câte zile
// după livrare mai rămâne o comandă deschisă pentru note.
export default function NoteSetup() {
  const [subiecte, setSubiecte] = useState(null)
  const [nou, setNou] = useState('')
  const [zile, setZile] = useState('')
  const [zileSalvate, setZileSalvate] = useState(null)
  const [mesaj, setMesaj] = useState('')

  const load = useCallback(async () => {
    const [s, setari] = await Promise.all([getSubiecteNote(), getSetariNote()])
    setSubiecte(s)
    setZile(String(setari.zile_dupa_livrare))
    setZileSalvate(setari.zile_dupa_livrare)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const adauga = async (e) => {
    e.preventDefault()
    setMesaj('')
    try {
      await addSubiectNota(nou)
      setNou('')
      await load()
    } catch (err) {
      setMesaj(err.message)
    }
  }

  const comuta = async (s) => {
    setMesaj('')
    try {
      await updateSubiectNota(s.id, { activ: !s.activ })
      await load()
    } catch (err) {
      setMesaj(err.message)
    }
  }

  const salveazaZile = async () => {
    const valoare = Math.max(0, Math.round(Number(zile) || 0))
    setZile(String(valoare))
    if (valoare === zileSalvate) return
    try {
      await updateSetariNote({ zile_dupa_livrare: valoare })
      setZileSalvate(valoare)
      setMesaj('')
    } catch (err) {
      setMesaj(err.message)
    }
  }

  return (
    <div className="card note-setup-card">
      <div className="note-setup-header">
        <h3>Note pe comandă</h3>
        <p>
          Subiectele din care se alege la fiecare notă. Un subiect dezactivat nu mai apare la note noi, dar rămâne pe
          notele existente.
        </p>
      </div>

      <div className="note-setup-zile">
        <label className="field-label" htmlFor="note-zile">Zile după livrare în care se mai pot adăuga note</label>
        <input
          id="note-zile"
          type="number"
          min="0"
          className="text-input"
          value={zile}
          onChange={(e) => setZile(e.target.value)}
          onBlur={salveazaZile}
        />
      </div>

      {subiecte === null ? (
        <p className="note-setup-gol">Se încarcă…</p>
      ) : (
        <ul className="note-setup-lista">
          {subiecte.map((s) => (
            <li key={s.id} className={`note-setup-rand ${s.activ ? '' : 'note-setup-rand-inactiv'}`}>
              <span>{s.nume}</span>
              <button type="button" className="btn btn-ghost note-setup-btn" onClick={() => comuta(s)}>
                {s.activ ? 'Dezactivează' : 'Activează'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="note-setup-form" onSubmit={adauga}>
        <input
          type="text"
          className="text-input"
          value={nou}
          onChange={(e) => setNou(e.target.value)}
          placeholder="Subiect nou"
          aria-label="Subiect nou"
        />
        <button type="submit" className="btn btn-primary" disabled={!nou.trim()}>
          Adaugă
        </button>
      </form>
      {mesaj && <p className="note-setup-eroare">{mesaj}</p>}
    </div>
  )
}
