import { useEffect, useRef, useState } from 'react'
import {
  getPozeLucrare,
  addPozaLucrare,
  deletePozaLucrare,
  getLinkuriLucrare,
  addLinkLucrare,
  deleteLinkLucrare,
} from '../services/dataService'
import { redimensioneazaImagine } from '../utils/imageResize'
import './GaleriePoze.css'

function formatData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function esteUrlValid(text) {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function trunchiazaUrl(url, max = 46) {
  if (url.length <= max) return url
  return `${url.slice(0, max - 1)}…`
}

// Siglă Drive simplificată (triunghi din 3 fațete colorate) — doar pentru
// recognoscibilitate vizuală lângă un link Drive, nu un asset oficial Google.
function IconDrive() {
  return (
    <svg width="18" height="18" viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}

export default function GaleriePoze({ lucrareId }) {
  const [poze, setPoze] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [lightboxId, setLightboxId] = useState(null)
  const fileInputRef = useRef(null)

  const [linkuri, setLinkuri] = useState([])
  const [linkUrl, setLinkUrl] = useState('')
  const [linkEticheta, setLinkEticheta] = useState('')
  const [linkError, setLinkError] = useState('')
  const [addingLink, setAddingLink] = useState(false)

  const load = async () => {
    setLoading(true)
    const [pozeData, linkuriData] = await Promise.all([getPozeLucrare(lucrareId), getLinkuriLucrare(lucrareId)])
    setPoze(pozeData)
    setLinkuri(linkuriData)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [lucrareId])

  const handleFiles = async (fileList) => {
    const fisiere = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'))
    if (fisiere.length === 0) return
    setUploading(true)
    setError('')
    const erori = []
    for (const file of fisiere) {
      try {
        const dataUrl = await redimensioneazaImagine(file)
        await addPozaLucrare(lucrareId, { numeFisier: file.name, referintaFisier: dataUrl })
      } catch (err) {
        erori.push(`${file.name}: ${err.message}`)
      }
    }
    await load()
    setUploading(false)
    if (erori.length > 0) setError(erori.join(' · '))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDelete = async (id) => {
    await deletePozaLucrare(id)
    if (lightboxId === id) setLightboxId(null)
    await load()
  }

  const handleAddLink = async (e) => {
    e.preventDefault()
    const url = linkUrl.trim()
    if (!esteUrlValid(url)) {
      setLinkError('Introdu un URL valid (ex. https://drive.google.com/…).')
      return
    }
    setLinkError('')
    setAddingLink(true)
    try {
      await addLinkLucrare(lucrareId, { url, eticheta: linkEticheta.trim() })
      setLinkUrl('')
      setLinkEticheta('')
      await load()
    } finally {
      setAddingLink(false)
    }
  }

  const handleDeleteLink = async (id) => {
    await deleteLinkLucrare(id)
    await load()
  }

  const pozaActiva = poze.find((p) => p.id === lightboxId)

  return (
    <div className="galerie">
      <div
        className={`galerie-dropzone ${dragOver ? 'galerie-dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p className="galerie-dropzone-title">Trage poze aici</p>
        <p className="galerie-dropzone-sub">sau</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Se încarcă…' : 'Alege fișiere'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="galerie-error">{error}</p>}

      {loading ? (
        <p className="galerie-loading">Se încarcă…</p>
      ) : poze.length === 0 ? (
        <p className="galerie-empty">Nicio poză încărcată încă pentru această lucrare.</p>
      ) : (
        <ul className="galerie-grid">
          {poze.map((poza) => (
            <li key={poza.id} className="galerie-thumb">
              <button
                type="button"
                className="galerie-thumb-btn"
                onClick={() => setLightboxId(poza.id)}
                aria-label={`Deschide poza ${poza.nume_fisier || ''}`}
              >
                <img src={poza.referinta_fisier} alt={poza.nume_fisier || 'Poză lucrare'} loading="lazy" />
              </button>
              <button
                type="button"
                className="galerie-thumb-delete"
                onClick={() => handleDelete(poza.id)}
                aria-label={`Șterge poza ${poza.nume_fisier || ''}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="galerie-links-section">
        <h3 className="galerie-links-title">Link-uri Drive</h3>

        <form className="galerie-link-form" onSubmit={handleAddLink}>
          <div className="galerie-link-form-row">
            <div className="galerie-link-form-field">
              <label className="field-label">Link Drive</label>
              <input
                type="text"
                className="text-input"
                placeholder="https://drive.google.com/…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="galerie-link-form-field galerie-link-form-field-eticheta">
              <label className="field-label">Etichetă (opțional)</label>
              <input
                type="text"
                className="text-input"
                placeholder="ex. Poze intraorale"
                value={linkEticheta}
                onChange={(e) => setLinkEticheta(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-secondary galerie-link-add-btn"
              disabled={addingLink || !linkUrl.trim()}
            >
              {addingLink ? 'Se adaugă…' : '+ Adaugă'}
            </button>
          </div>
          {linkError && <p className="galerie-error">{linkError}</p>}
        </form>

        {linkuri.length === 0 ? (
          <p className="galerie-empty">Niciun link adăugat încă.</p>
        ) : (
          <ul className="galerie-links-list">
            {linkuri.map((link) => (
              <li key={link.id} className="galerie-link-row">
                <a
                  className="galerie-link-anchor"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <IconDrive />
                  <span className="galerie-link-label">{link.eticheta || trunchiazaUrl(link.url)}</span>
                </a>
                <button
                  type="button"
                  className="galerie-link-delete"
                  onClick={() => handleDeleteLink(link.id)}
                  aria-label={`Șterge link-ul ${link.eticheta || link.url}`}
                  title="Șterge link-ul"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pozaActiva && (
        <div className="galerie-lightbox" onMouseDown={(e) => { if (e.target === e.currentTarget) setLightboxId(null) }}>
          <img src={pozaActiva.referinta_fisier} alt={pozaActiva.nume_fisier || 'Poză lucrare'} />
          <div className="galerie-lightbox-caption">
            <span>{pozaActiva.nume_fisier}</span>
            <span>{formatData(pozaActiva.data_incarcare)}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost galerie-lightbox-close"
            onClick={() => setLightboxId(null)}
            aria-label="Închide"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
