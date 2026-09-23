import './ExtraUriPicker.css'

// Etichete (chips) pentru extra-urile unei comenzi — fără prețuri.
// `optiuni`: extra-urile active care se pot adăuga (fără Try-in).
// `selectie`: [{ extra_id, nume, mod_taxare, cantitate }] — poate conține și
// extra-uri dezactivate între timp, rămase pe o lucrare veche.
export default function ExtraUriPicker({ optiuni, selectie, onChange, disabled = false }) {
  const selectate = new Map(selectie.map((s) => [s.extra_id, s]))
  const neselectate = optiuni.filter((o) => !selectate.has(o.id))

  const adauga = (o) =>
    onChange([...selectie, { extra_id: o.id, nume: o.nume, mod_taxare: o.mod_taxare, cantitate: 1 }])
  const scoate = (id) => onChange(selectie.filter((s) => s.extra_id !== id))
  const schimbaCantitatea = (id, delta) =>
    onChange(selectie.map((s) => (s.extra_id === id ? { ...s, cantitate: Math.max(1, (Number(s.cantitate) || 1) + delta) } : s)))

  if (selectie.length === 0 && optiuni.length === 0) {
    return <p className="extra-uri-gol">Niciun extra configurat în Setup.</p>
  }

  return (
    <div className="extra-uri-chips">
      {selectie.map((s) => (
        <span key={s.extra_id} className="extra-chip extra-chip-selectat">
          <button
            type="button"
            className="extra-chip-nume"
            onClick={() => scoate(s.extra_id)}
            disabled={disabled}
            aria-pressed="true"
            title="Click ca să scoți extra-ul"
          >
            {s.nume}
          </button>
          {s.mod_taxare === 'per_bucata' && (
            <span className="extra-chip-stepper">
              <button
                type="button"
                onClick={() => schimbaCantitatea(s.extra_id, -1)}
                disabled={disabled || s.cantitate <= 1}
                aria-label={`Scade cantitatea — ${s.nume}`}
              >
                −
              </button>
              <span className="extra-chip-cantitate" aria-label="Cantitate">{s.cantitate}</span>
              <button
                type="button"
                onClick={() => schimbaCantitatea(s.extra_id, 1)}
                disabled={disabled}
                aria-label={`Crește cantitatea — ${s.nume}`}
              >
                +
              </button>
            </span>
          )}
          <button
            type="button"
            className="extra-chip-x"
            onClick={() => scoate(s.extra_id)}
            disabled={disabled}
            aria-label={`Scoate ${s.nume}`}
          >
            ×
          </button>
        </span>
      ))}
      {neselectate.map((o) => (
        <button
          key={o.id}
          type="button"
          className="extra-chip"
          onClick={() => adauga(o)}
          disabled={disabled}
          aria-pressed="false"
        >
          + {o.nume}
        </button>
      ))}
    </div>
  )
}

// Afișare doar-citire (tehnician): nume + cantitate.
export function ExtraUriLista({ selectie }) {
  if (selectie.length === 0) return <p className="extra-uri-gol">Niciun extra.</p>
  return (
    <ul className="extra-uri-lista">
      {selectie.map((s) => (
        <li key={s.extra_id}>
          {s.nume} <span className="extra-uri-lista-cantitate">× {s.cantitate}</span>
        </li>
      ))}
    </ul>
  )
}
