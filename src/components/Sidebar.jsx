import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'lista', label: 'Listă lucrări' },
  { id: 'setup', label: 'Setup' },
  { id: 'taskuri', label: 'Task-uri' },
  { id: 'capacitate', label: 'Capacitate' },
  { id: 'salarii', label: 'Salarii' },
]

export default function Sidebar({ activePage, onNavigate }) {
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
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
