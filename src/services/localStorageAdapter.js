// Implementare locală (localStorage) a stratului de acces la date.
//
// Respectă exact aceeași structură de date ca schema Supabase din
// `src/data/schema.sql`, astfel încât să poată fi înlocuită cu o
// implementare care vorbește direct cu Supabase fără a schimba restul
// aplicației (vezi `src/services/dataService.js`).

import {
  DEFAULT_TIPURI_LUCRARE,
  DEFAULT_CULORI,
  DEFAULT_MEDICI,
  DEFAULT_CLINICI,
} from '../data/configDefaults'

// v2: schema lucrărilor s-a schimbat (pacient, termen_predare, next_date,
// dinti ca listă de obiecte {numar, grup}) — namespace nou ca să nu intre în
// coliziune cu datele salvate de v1.
const KEYS = {
  lucrari: 'aa_lucrari_v2',
  tipuri_lucrare: 'aa_config_tipuri_lucrare_v2',
  culori: 'aa_config_culori_v2',
  medici: 'aa_config_medici_v2',
  clinici: 'aa_config_clinici_v2',
  seeded: 'aa_seeded_v2',
}

const CONFIG_DEFAULTS = {
  tipuri_lucrare: DEFAULT_TIPURI_LUCRARE,
  culori: DEFAULT_CULORI,
  medici: DEFAULT_MEDICI,
  clinici: DEFAULT_CLINICI,
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function ensureSeeded() {
  if (readJSON(KEYS.seeded, false)) return
  if (!readJSON(KEYS.lucrari, null)) writeJSON(KEYS.lucrari, [])
  for (const tip of Object.keys(CONFIG_DEFAULTS)) {
    if (!readJSON(KEYS[tip], null)) writeJSON(KEYS[tip], CONFIG_DEFAULTS[tip])
  }
  writeJSON(KEYS.seeded, true)
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDinti(dinti) {
  if (!Array.isArray(dinti)) return []
  return dinti
    .map((d) => {
      if (typeof d === 'number') return { numar: d, grup: null }
      if (d && typeof d === 'object' && typeof d.numar === 'number') {
        return { numar: d.numar, grup: d.grup ?? null }
      }
      return null
    })
    .filter(Boolean)
}

async function generateNrInregistrare() {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  let max = 0
  for (const l of lucrari) {
    const m = /^AA-(\d+)$/.exec(l.nr_inregistrare || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  const next = max + 1
  return `AA-${String(next).padStart(3, '0')}`
}

async function getLucrari() {
  ensureSeeded()
  return readJSON(KEYS.lucrari, [])
}

function buildLucrare(input, existingId) {
  const dinti = normalizeDinti(input.dinti)
  return {
    id: existingId || uuid(),
    nr_inregistrare: input.nr_inregistrare,
    clinica: input.clinica || '',
    medic: input.medic || '',
    pacient: input.pacient || '',
    tip_lucrare: input.tip_lucrare || '',
    dinti,
    nr_elemente:
      input.nr_elemente !== undefined && input.nr_elemente !== null && input.nr_elemente !== ''
        ? Number(input.nr_elemente)
        : dinti.length,
    culoare: input.culoare || '',
    implant: !!input.implant,
    model: input.model || '',
    data_intrare: input.data_intrare || todayISO(),
    termen_predare: input.termen_predare || '',
    next_date: input.next_date || '',
    nota: input.nota || '',
  }
}

async function addLucrare(input) {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  const nr_inregistrare = input.nr_inregistrare || (await generateNrInregistrare())
  const lucrare = {
    ...buildLucrare({ ...input, nr_inregistrare }),
    created_at: new Date().toISOString(),
  }
  lucrari.push(lucrare)
  writeJSON(KEYS.lucrari, lucrari)
  return lucrare
}

async function updateLucrare(id, patch) {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  const idx = lucrari.findIndex((l) => l.id === id)
  if (idx === -1) throw new Error(`Lucrarea cu id ${id} nu a fost găsită`)
  const merged = { ...lucrari[idx], ...patch }
  if (patch.dinti !== undefined) merged.dinti = normalizeDinti(patch.dinti)
  lucrari[idx] = merged
  writeJSON(KEYS.lucrari, lucrari)
  return lucrari[idx]
}

async function deleteLucrare(id) {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  writeJSON(KEYS.lucrari, lucrari.filter((l) => l.id !== id))
}

async function getConfigList(tip) {
  ensureSeeded()
  if (!KEYS[tip]) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  return readJSON(KEYS[tip], [])
}

async function addConfigValue(tip, nume) {
  ensureSeeded()
  if (!KEYS[tip]) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Valoarea nu poate fi goală')
  const lista = readJSON(KEYS[tip], [])
  if (!lista.includes(valoare)) {
    lista.push(valoare)
    writeJSON(KEYS[tip], lista)
  }
  return valoare
}

async function importLucrari(rows) {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  const existingNr = new Set(lucrari.map((l) => l.nr_inregistrare))
  let successCount = 0
  const erori = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNr = i + 2 // +1 header, +1 index-1-based
    try {
      if (!row.tip_lucrare) throw new Error('tip_lucrare lipsă')
      if (row.model && !['Gips', 'Print', ''].includes(row.model)) {
        throw new Error(`model invalid: "${row.model}" (trebuie Gips sau Print)`)
      }

      let dinti = []
      if (row.dinti) {
        try {
          const parsed = JSON.parse(row.dinti)
          if (!Array.isArray(parsed)) throw new Error()
          dinti = normalizeDinti(parsed)
        } catch {
          dinti = String(row.dinti)
            .split(/[;, ]+/)
            .filter(Boolean)
            .map((n) => parseInt(n, 10))
            .filter((n) => !Number.isNaN(n))
            .map((numar) => ({ numar, grup: null }))
        }
      }

      let nr_inregistrare = row.nr_inregistrare && row.nr_inregistrare.trim()
      if (nr_inregistrare && existingNr.has(nr_inregistrare)) {
        throw new Error(`nr_inregistrare "${nr_inregistrare}" există deja`)
      }
      if (!nr_inregistrare) {
        let max = 0
        for (const l of lucrari) {
          const m = /^AA-(\d+)$/.exec(l.nr_inregistrare || '')
          if (m) max = Math.max(max, parseInt(m[1], 10))
        }
        nr_inregistrare = `AA-${String(max + 1).padStart(3, '0')}`
      }

      const lucrare = {
        ...buildLucrare({
          nr_inregistrare,
          clinica: row.clinica,
          medic: row.medic,
          pacient: row.pacient,
          tip_lucrare: row.tip_lucrare,
          dinti,
          nr_elemente: row.nr_elemente,
          culoare: row.culoare,
          implant: row.implant === 'true' || row.implant === true || row.implant === '1',
          model: row.model,
          data_intrare: row.data_intrare,
          termen_predare: row.termen_predare,
          next_date: row.next_date,
          nota: row.nota,
        }),
        created_at: new Date().toISOString(),
      }

      lucrari.push(lucrare)
      existingNr.add(nr_inregistrare)
      successCount++
    } catch (err) {
      erori.push({ rand: rowNr, motiv: err.message })
    }
  }

  writeJSON(KEYS.lucrari, lucrari)
  return { importate: successCount, sarite: erori.length, erori }
}

export const localStorageAdapter = {
  getLucrari,
  addLucrare,
  updateLucrare,
  deleteLucrare,
  getConfigList,
  addConfigValue,
  generateNrInregistrare,
  importLucrari,
}
