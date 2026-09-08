import { useState } from 'react'
import { signIn } from '../services/auth'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [parola, setParola] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    try {
      await signIn(email.trim(), parola, rememberMe)
      // succesul declanșează automat onAuthStateChange în App — nu mai e
      // nevoie de nicio acțiune suplimentară aici.
    } catch (err) {
      setError('Email sau parolă greșită.')
      setSaving(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="app-logo-dot" aria-hidden="true" />
          <div>
            <h1>Algorithm Aesthetics</h1>
            <p>Registru lucrări laborator</p>
          </div>
        </div>

        <h2 className="login-title">Autentificare</h2>

        <div>
          <label className="field-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="text-input"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="login-parola">Parolă</label>
          <input
            id="login-parola"
            type="password"
            className="text-input"
            autoComplete="current-password"
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            required
          />
        </div>

        <label className="login-remember">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Rămâi conectat</span>
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="btn btn-primary login-submit" disabled={saving}>
          {saving ? 'Se conectează…' : 'Intră în cont'}
        </button>
      </form>
    </div>
  )
}
