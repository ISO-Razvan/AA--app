import { useState } from 'react'
import './Sidebar.css'

const NAV_GROUPS_ADMIN = [
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
    id: 'financiar',
    label: 'Financiar',
    children: [{ id: 'salarii', label: 'Salarii' }],
  },
  { id: 'setup', label: 'Setup' },
]

function grupulPentru(pagina) {
  return NAV_GROUPS_ADMIN.find((g) => g.children?.some((c) => c.id === pagina))?.id || null
}

export default function Sidebar({ activePage, onNavigate, profile, onSignOut }) {
  const esteTehnician = profile?.rol === 'tehnician'

  // Grupul care conține pagina curentă e expandat implicit la încărcare;
  // ulterior fiecare grup se extinde/restrânge independent (accordion).
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const initial = grupulPentru(activePage)
    return initial ? new Set([initial]) : new Set()
  })

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="app-logo-dot" aria-hidden="true" />
        <div className="sidebar-brand-text">
          <h1>Algorithm Aesthetics</h1>
          <p>Registru lucrări laborator</p>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Navigare principală">
        {esteTehnician ? (
          <button
            type="button"
            className={`sidebar-nav-item ${activePage === 'task-urile-mele' ? 'active' : ''}`}
            onClick={() => onNavigate('task-urile-mele')}
            aria-current={activePage === 'task-urile-mele' ? 'page' : undefined}
          >
            Task-urile mele
          </button>
        ) : (
          NAV_GROUPS_ADMIN.map((item) =>
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
                        onClick={() => onNavigate(child.id)}
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
                onClick={() => onNavigate(item.id)}
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
          <span className="sidebar-account-name">{profile?.nume || (profile?.rol === 'admin' ? 'Administrator' : 'Tehnician')}</span>
          <span className="sidebar-account-rol">{profile?.rol === 'admin' ? 'Administrator' : 'Tehnician'}</span>
        </div>
        <button type="button" className="btn btn-ghost sidebar-signout-btn" onClick={onSignOut}>
          Deconectare
        </button>
      </div>
    </aside>
  )
}
