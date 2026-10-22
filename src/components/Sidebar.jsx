import { useState } from 'react'
import SchimbaParolaDialog from './SchimbaParolaDialog.jsx'
import { estePatron, esteTehnician as rolTehnician, etichetaRol } from '../utils/roluri'
import './Sidebar.css'

const NAV_TEHNICIAN = [
  { id: 'task-urile-mele', label: 'Task-urile mele' },
  { id: 'salariul-meu', label: 'Salariul meu' },
  { id: 'neconformitati', label: 'Neconformități' },
  { id: 'ghid', label: 'Ghid' },
]

// Patronul vede tot; coordonatorul la fel, fără grupul Financiar.
const NAV_GROUPS = [
  { id: 'dashboard', label: 'Dashboard' },
  {
    id: 'comenzi',
    label: 'Comenzi',
    children: [
      { id: 'lista', label: 'Listă lucrări' },
      { id: 'taskuri', label: 'Task-uri' },
      { id: 'capacitate', label: 'Capacitate' },
    ],
  },
  {
    id: 'calitate',
    label: 'Calitate',
    children: [
      { id: 'neconformitati', label: 'Neconformități' },
      { id: 'furnizori', label: 'Furnizori' },
    ],
  },
  {
    id: 'financiar',
    label: 'Financiar',
    doarPatron: true,
    children: [
      { id: 'financiar-rapoarte', label: 'Financiar' },
      { id: 'salarii', label: 'Salarii' },
    ],
  },
  { id: 'setup', label: 'Setup' },
  { id: 'ghid', label: 'Ghid' },
]

function grupulPentru(pagina) {
  return NAV_GROUPS.find((g) => g.children?.some((c) => c.id === pagina))?.id || null
}

export default function Sidebar({ activePage, onNavigate, profile, onSignOut }) {
  const esteTehnician = rolTehnician(profile)
  const navGroups = NAV_GROUPS.filter((g) => !g.doarPatron || estePatron(profile))

  // Grupul care conține pagina curentă e expandat implicit la încărcare;
  // ulterior fiecare grup se extinde/restrânge independent (accordion).
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = grupulPentru(activePage)
    return initial ? new Set([initial]) : new Set()
  })
  // Panoul glisant de pe mobil (sub 880px) — închis implicit; desktop-ul nu
  // folosește deloc starea asta (sidebar-ul rămâne mereu vizibil acolo).
  const [mobilDeschis, setMobilDeschis] = useState(false)
  const [schimbaParolaDeschis, setSchimbaParolaDeschis] = useState(false)

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const navigheaza = (id) => {
    onNavigate(id)
    setMobilDeschis(false)
  }

  return (
    <>
      <div className="sidebar-mobile-bar">
        <div className="sidebar-brand">
          <img className="app-logo" src="/logo.png" alt="Algorithm Lab" />
          <div className="sidebar-brand-text">
            <h1>Algorithm Aesthetics</h1>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-hamburger-btn"
          onClick={() => setMobilDeschis(true)}
          aria-label="Deschide meniul de navigare"
          aria-expanded={mobilDeschis}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      {mobilDeschis && <div className="sidebar-backdrop" onClick={() => setMobilDeschis(false)} aria-hidden="true" />}

      <aside className={`sidebar ${mobilDeschis ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <img className="app-logo" src="/logo.png" alt="Algorithm Lab" />
          <div className="sidebar-brand-text">
            <h1>Algorithm Aesthetics</h1>
            <p>Registru lucrări laborator</p>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => setMobilDeschis(false)}
          aria-label="Închide meniul de navigare"
        >
          ✕
        </button>

        <nav className="sidebar-nav" aria-label="Navigare principală">
          {esteTehnician ? (
            NAV_TEHNICIAN.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => navigheaza(item.id)}
                aria-current={activePage === item.id ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))
          ) : (
            navGroups.map((item) =>
              item.children ? (
                <div className="sidebar-nav-group" key={item.id}>
                  <button
                    type="button"
                    className="sidebar-nav-item sidebar-nav-group-toggle"
                    onClick={() => toggleGroup(item.id)}
                    aria-expanded={expandedGroups.has(item.id)}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`sidebar-nav-group-arrow ${expandedGroups.has(item.id) ? 'expanded' : ''}`}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                  {expandedGroups.has(item.id) && (
                    <div className="sidebar-nav-subgroup">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`sidebar-nav-item sidebar-nav-subitem ${activePage === child.id ? 'active' : ''}`}
                          onClick={() => navigheaza(child.id)}
                          aria-current={activePage === child.id ? 'page' : undefined}
                        >
                          {child.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => navigheaza(item.id)}
                  aria-current={activePage === item.id ? 'page' : undefined}
                >
                  {item.label}
                </button>
              )
            )
          )}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-account-info">
            <span className="sidebar-account-name">{profile?.nume || etichetaRol(profile)}</span>
            <span className="sidebar-account-rol">{etichetaRol(profile)}</span>
          </div>
          <div className="sidebar-account-actions">
            <button type="button" className="btn btn-ghost sidebar-signout-btn" onClick={() => setSchimbaParolaDeschis(true)}>
              Schimbă parola
            </button>
            <button type="button" className="btn btn-ghost sidebar-signout-btn" onClick={onSignOut}>
              Deconectare
            </button>
          </div>
        </div>
      </aside>

      {schimbaParolaDeschis && <SchimbaParolaDialog onClose={() => setSchimbaParolaDeschis(false)} />}
    </>
  )
}
