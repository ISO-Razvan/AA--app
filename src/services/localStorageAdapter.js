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
  DEFAULT_ETAPE_PRODUCTIE,
} from '../data/configDefaults'
import { azi as todayISO } from '../utils/date'

// v2: schema lucrărilor s-a schimbat (pacient, termen_predare, next_date,
// dinti ca listă de obiecte {numar, grup}) — namespace nou ca să nu intre în
// coliziune cu datele salvate de v1.
const KEYS = {
  lucrari: 'aa_lucrari_v2',
  tipuri_lucrare: 'aa_config_tipuri_lucrare_v2',
  culori: 'aa_config_culori_v2',
  medici: 'aa_config_medici_v2',
  clinici: 'aa_config_clinici_v2',
  etape_productie: 'aa_config_etape_productie_v2',
  tehnicieni: 'aa_config_tehnicieni_v2',
  comisioane: 'aa_config_comisioane_v2',
  productie_lucrare: 'aa_productie_lucrare_v2',
  poze_lucrare: 'aa_poze_lucrare_v2',
  linkuri_lucrare: 'aa_linkuri_lucrare_v2',
  seeded: 'aa_seeded_v2',
}

// tipuri_lucrare NU e în această listă — are formă bogată ({nume,
// cost_laborator, incasare}), nu un string simplu, și e seedat/migrat separat
// mai jos (vezi ensureSeeded).
const CONFIG_DEFAULTS = {
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
  // Migrare: instalările deja inițializate (seeded=true dintr-o versiune
  // anterioară) trebuie să primească oricum tabelul nou `etape_productie`,
  // nu doar instalările complet noi — de aceea acest bloc rulează
  // independent de flag-ul `seeded`.
  if (!readJSON(KEYS.etape_productie, null)) {
    writeJSON(
      KEYS.etape_productie,
      DEFAULT_ETAPE_PRODUCTIE.map((nume, i) => ({ id: uuid(), nume, ordine: i + 1, durata_minute: 0 }))
    )
  } else {
    // Migrare: instalările mai vechi au etape fără `durata_minute`.
    const etapeExistente = readJSON(KEYS.etape_productie, [])
    if (etapeExistente.some((e) => e.durata_minute === undefined)) {
      writeJSON(
        KEYS.etape_productie,
        etapeExistente.map((e) => ({ durata_minute: 0, ...e }))
      )
    }
  }
  if (!readJSON(KEYS.tehnicieni, null)) writeJSON(KEYS.tehnicieni, [])
  if (!readJSON(KEYS.comisioane, null)) writeJSON(KEYS.comisioane, [])
  if (!readJSON(KEYS.productie_lucrare, null)) writeJSON(KEYS.productie_lucrare, [])
  if (!readJSON(KEYS.poze_lucrare, null)) writeJSON(KEYS.poze_lucrare, [])
  if (!readJSON(KEYS.linkuri_lucrare, null)) writeJSON(KEYS.linkuri_lucrare, [])

  // tipuri_lucrare: seed direct cu forma bogată dacă lipsește, sau migrează
  // în loc o instalare mai veche care avea doar un array de string-uri.
  const tipuriExistente = readJSON(KEYS.tipuri_lucrare, null)
  if (!tipuriExistente) {
    writeJSON(
      KEYS.tipuri_lucrare,
      DEFAULT_TIPURI_LUCRARE.map((nume) => ({ id: uuid(), nume, cost_laborator: 0, incasare: 0 }))
    )
  } else if (tipuriExistente.length > 0 && typeof tipuriExistente[0] === 'string') {
    writeJSON(
      KEYS.tipuri_lucrare,
      tipuriExistente.map((nume) => ({ id: uuid(), nume, cost_laborator: 0, incasare: 0 }))
    )
  }

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
    try_in: !!input.try_in,
    model: input.model || '',
    data_intrare: input.data_intrare || todayISO(),
    termen_predare: input.termen_predare || '',
    ora_programare: input.ora_programare || '',
    next_date: input.next_date || '',
    nota: input.nota || '',
  }
}

async function addLucrare(input) {
  ensureSeeded()
  const lucrari = readJSON(KEYS.lucrari, [])
  const nr_inregistrare = input.nr_inregistrare || (await generateNrInregistrare())
  const built = buildLucrare({ ...input, nr_inregistrare })
  const lucrare = {
    ...built,
    ...getSnapshotFinanciar(built.tip_lucrare),
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
  // la fel ca `on delete cascade` din schema.sql
  const productie = readJSON(KEYS.productie_lucrare, [])
  writeJSON(KEYS.productie_lucrare, productie.filter((r) => r.lucrare_id !== id))
  const poze = readJSON(KEYS.poze_lucrare, [])
  writeJSON(KEYS.poze_lucrare, poze.filter((p) => p.lucrare_id !== id))
  const linkuri = readJSON(KEYS.linkuri_lucrare, [])
  writeJSON(KEYS.linkuri_lucrare, linkuri.filter((l) => l.lucrare_id !== id))
}

async function getConfigList(tip) {
  ensureSeeded()
  if (!KEYS[tip]) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  const lista = readJSON(KEYS[tip], [])
  // tipuri_lucrare are formă bogată intern ({nume, cost_laborator, incasare})
  // dar dropdown-urile existente (SearchableSelect) așteaptă string-uri simple.
  if (tip === 'tipuri_lucrare') return lista.map((t) => t.nume)
  return lista
}

async function addConfigValue(tip, nume) {
  ensureSeeded()
  if (!KEYS[tip]) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Valoarea nu poate fi goală')
  const lista = readJSON(KEYS[tip], [])

  if (tip === 'tipuri_lucrare') {
    if (!lista.some((t) => t.nume.toLowerCase() === valoare.toLowerCase())) {
      lista.push({ id: uuid(), nume: valoare, cost_laborator: 0, incasare: 0 })
      writeJSON(KEYS[tip], lista)
    }
    return valoare
  }

  if (!lista.includes(valoare)) {
    lista.push(valoare)
    writeJSON(KEYS[tip], lista)
  }
  return valoare
}

async function getTipuriLucrareDetaliate() {
  ensureSeeded()
  return readJSON(KEYS.tipuri_lucrare, [])
}

async function updateTipLucrareCosturi(id, { cost_laborator, incasare }) {
  ensureSeeded()
  const tipuri = readJSON(KEYS.tipuri_lucrare, [])
  const idx = tipuri.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error(`Tipul de lucrare cu id ${id} nu a fost găsit`)
  tipuri[idx] = {
    ...tipuri[idx],
    cost_laborator: cost_laborator === '' || cost_laborator == null ? 0 : Number(cost_laborator),
    incasare: incasare === '' || incasare == null ? 0 : Number(incasare),
  }
  writeJSON(KEYS.tipuri_lucrare, tipuri)
  return tipuri[idx]
}

async function addTipLucrare(nume) {
  ensureSeeded()
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele tipului de lucrare nu poate fi gol')
  const tipuri = readJSON(KEYS.tipuri_lucrare, [])
  if (tipuri.some((t) => t.nume.toLowerCase() === valoare.toLowerCase())) {
    throw new Error(`Tipul de lucrare „${valoare}” există deja`)
  }
  const tip = { id: uuid(), nume: valoare, cost_laborator: 0, incasare: 0 }
  tipuri.push(tip)
  writeJSON(KEYS.tipuri_lucrare, tipuri)
  return tip
}

// Redenumește un tip de lucrare și propagă noul nume în grila de comisioane
// (cheia acolo e numele, nu id-ul) — altfel comisioanele deja setate ar
// "dispărea" din grilă după o redenumire. Lucrările deja înregistrate NU se
// ating: `lucrari.tip_lucrare` e un instantaneu de text de la momentul
// înregistrării, complet independent de tabela de configurare.
async function renameTipLucrare(id, numeNou) {
  ensureSeeded()
  const valoare = String(numeNou || '').trim()
  if (!valoare) throw new Error('Numele tipului de lucrare nu poate fi gol')
  const tipuri = readJSON(KEYS.tipuri_lucrare, [])
  const idx = tipuri.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error(`Tipul de lucrare cu id ${id} nu a fost găsit`)
  const numeVechi = tipuri[idx].nume
  if (numeVechi === valoare) return tipuri[idx]
  if (tipuri.some((t) => t.id !== id && t.nume.toLowerCase() === valoare.toLowerCase())) {
    throw new Error(`Tipul de lucrare „${valoare}” există deja`)
  }
  tipuri[idx] = { ...tipuri[idx], nume: valoare }
  writeJSON(KEYS.tipuri_lucrare, tipuri)

  const comisioane = readJSON(KEYS.comisioane, [])
  const comisioaneActualizate = comisioane.map((c) =>
    c.tip_lucrare === numeVechi ? { ...c, tip_lucrare: valoare } : c
  )
  writeJSON(KEYS.comisioane, comisioaneActualizate)

  return tipuri[idx]
}

// Șterge tipul de lucrare din configurare — lucrările deja înregistrate cu
// acest tip își păstrează valoarea (text simplu, independent de configurare)
// și pur și simplu nu mai apare ca opțiune pentru lucrări noi. Rândurile de
// comisioane asociate se șterg și ele (nu mai au sens fără tipul de lucrare).
async function deleteTipLucrare(id) {
  ensureSeeded()
  const tipuri = readJSON(KEYS.tipuri_lucrare, [])
  const tip = tipuri.find((t) => t.id === id)
  writeJSON(KEYS.tipuri_lucrare, tipuri.filter((t) => t.id !== id))
  if (tip) {
    const comisioane = readJSON(KEYS.comisioane, [])
    writeJSON(KEYS.comisioane, comisioane.filter((c) => c.tip_lucrare !== tip.nume))
  }
}

async function getComisioane() {
  ensureSeeded()
  return readJSON(KEYS.comisioane, [])
}

async function setComisiune(tipLucrare, etapaId, suma) {
  ensureSeeded()
  const comisioane = readJSON(KEYS.comisioane, [])
  const idx = comisioane.findIndex((c) => c.tip_lucrare === tipLucrare && c.etapa_id === etapaId)
  const valoare = suma === '' || suma == null ? 0 : Number(suma)
  if (idx === -1) {
    const rand = { id: uuid(), tip_lucrare: tipLucrare, etapa_id: etapaId, suma: valoare }
    comisioane.push(rand)
    writeJSON(KEYS.comisioane, comisioane)
    return rand
  }
  comisioane[idx] = { ...comisioane[idx], suma: valoare }
  writeJSON(KEYS.comisioane, comisioane)
  return comisioane[idx]
}

async function getProductieLucrare(lucrareId) {
  ensureSeeded()
  return readJSON(KEYS.productie_lucrare, []).filter((r) => r.lucrare_id === lucrareId)
}

// Toate alocările unui tehnician, pe toate lucrările — folosit de pagina
// „Task-uri" (Sidebar), care afișează sarcinile unui tehnician pentru o zi
// aleasă. Filtrarea pe dată se face în UI, nu aici, ca să nu fie nevoie de
// un apel nou la fiecare schimbare de zi.
async function getProductieTehnician(tehnicianId) {
  ensureSeeded()
  return readJSON(KEYS.productie_lucrare, []).filter((r) => r.tehnician_id === tehnicianId)
}

// Toate alocările, pe toți tehnicienii — folosit de pagina „Capacitate"
// (matricea tehnician × zi), care are nevoie de tot tabelul deodată ca să nu
// facă un apel separat per tehnician/zi.
async function getToateAlocarile() {
  ensureSeeded()
  return readJSON(KEYS.productie_lucrare, [])
}

async function setProductieAlocare(lucrareId, etapaId, patch) {
  ensureSeeded()
  const randuri = readJSON(KEYS.productie_lucrare, [])
  const idx = randuri.findIndex((r) => r.lucrare_id === lucrareId && r.etapa_id === etapaId)
  if (idx === -1) {
    const rand = {
      id: uuid(),
      lucrare_id: lucrareId,
      etapa_id: etapaId,
      tehnician_id: null,
      data_planificata: '',
      finalizat: false,
      data_finalizare: '',
      ...patch,
    }
    randuri.push(rand)
    writeJSON(KEYS.productie_lucrare, randuri)
    return rand
  }
  randuri[idx] = { ...randuri[idx], ...patch }
  writeJSON(KEYS.productie_lucrare, randuri)
  return randuri[idx]
}

async function getPozeLucrare(lucrareId) {
  ensureSeeded()
  return readJSON(KEYS.poze_lucrare, [])
    .filter((p) => p.lucrare_id === lucrareId)
    .sort((a, b) => new Date(b.data_incarcare) - new Date(a.data_incarcare))
}

// `referinta_fisier` e deocamdată un data URL base64 (vezi nota din
// schema.sql) — la conectarea Supabase, apelantul va trebui să încarce
// fișierul în Supabase Storage și să dea aici URL-ul rezultat, nu bytes.
async function addPozaLucrare(lucrareId, { numeFisier, referintaFisier }) {
  ensureSeeded()
  if (!referintaFisier) throw new Error('Fișierul imaginii lipsește')
  const poze = readJSON(KEYS.poze_lucrare, [])
  const poza = {
    id: uuid(),
    lucrare_id: lucrareId,
    nume_fisier: numeFisier || '',
    referinta_fisier: referintaFisier,
    data_incarcare: new Date().toISOString(),
  }
  poze.push(poza)
  try {
    writeJSON(KEYS.poze_lucrare, poze)
  } catch (err) {
    if (err && err.name === 'QuotaExceededError') {
      throw new Error('Spațiul de stocare local este plin — șterge poze vechi sau eliberează spațiu în browser.')
    }
    throw err
  }
  return poza
}

async function deletePozaLucrare(id) {
  ensureSeeded()
  const poze = readJSON(KEYS.poze_lucrare, [])
  writeJSON(KEYS.poze_lucrare, poze.filter((p) => p.id !== id))
}

async function getLinkuriLucrare(lucrareId) {
  ensureSeeded()
  return readJSON(KEYS.linkuri_lucrare, [])
    .filter((l) => l.lucrare_id === lucrareId)
    .sort((a, b) => new Date(b.data_adaugare) - new Date(a.data_adaugare))
}

async function addLinkLucrare(lucrareId, { url, eticheta }) {
  ensureSeeded()
  if (!url) throw new Error('URL-ul lipsește')
  const linkuri = readJSON(KEYS.linkuri_lucrare, [])
  const link = {
    id: uuid(),
    lucrare_id: lucrareId,
    url,
    eticheta: eticheta || '',
    data_adaugare: new Date().toISOString(),
  }
  linkuri.push(link)
  writeJSON(KEYS.linkuri_lucrare, linkuri)
  return link
}

async function deleteLinkLucrare(id) {
  ensureSeeded()
  const linkuri = readJSON(KEYS.linkuri_lucrare, [])
  writeJSON(KEYS.linkuri_lucrare, linkuri.filter((l) => l.id !== id))
}

// Instantaneu financiar copiat pe o lucrare la momentul înregistrării —
// modificările ulterioare din Setup (cost/încasare/comisioane) nu mai ating
// lucrările deja create.
function getSnapshotFinanciar(tipLucrareNume) {
  const tipuri = readJSON(KEYS.tipuri_lucrare, [])
  const tip = tipuri.find((t) => t.nume === tipLucrareNume)
  const cost_laborator = tip ? Number(tip.cost_laborator) || 0 : 0
  const incasare = tip ? Number(tip.incasare) || 0 : 0

  const etape = readJSON(KEYS.etape_productie, [])
  const etapeById = new Map(etape.map((e) => [e.id, e]))
  const comisioane = readJSON(KEYS.comisioane, [])
    .filter((c) => c.tip_lucrare === tipLucrareNume)
    .map((c) => ({ etapa_id: c.etapa_id, etapa_nume: etapeById.get(c.etapa_id)?.nume || '', suma: c.suma }))

  return {
    cost_laborator,
    incasare,
    profit: incasare - cost_laborator,
    comisioane,
  }
}

async function getEtapeProductie() {
  ensureSeeded()
  const etape = readJSON(KEYS.etape_productie, [])
  return [...etape].sort((a, b) => a.ordine - b.ordine)
}

async function addEtapaProductie(nume) {
  ensureSeeded()
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele etapei nu poate fi gol')
  const etape = readJSON(KEYS.etape_productie, [])
  if (etape.some((e) => e.nume.toLowerCase() === valoare.toLowerCase())) {
    throw new Error(`Etapa „${valoare}” există deja`)
  }
  const ordine = etape.reduce((max, e) => Math.max(max, e.ordine), 0) + 1
  const etapa = { id: uuid(), nume: valoare, ordine, durata_minute: 0 }
  etape.push(etapa)
  writeJSON(KEYS.etape_productie, etape)
  return etapa
}

// Durată estimată (minute) per element, pentru o etapă — folosită ulterior
// pentru a calcula automat orele de muncă alocate unui tehnician
// (nr. elemente ale lucrării × durata etapei) în ecranul de capacitate.
async function updateEtapaDurata(id, durataMinute) {
  ensureSeeded()
  const etape = readJSON(KEYS.etape_productie, [])
  const idx = etape.findIndex((e) => e.id === id)
  if (idx === -1) throw new Error(`Etapa cu id ${id} nu a fost găsită`)
  const valoare = durataMinute === '' || durataMinute == null ? 0 : Number(durataMinute)
  etape[idx] = { ...etape[idx], durata_minute: Number.isFinite(valoare) && valoare >= 0 ? valoare : 0 }
  writeJSON(KEYS.etape_productie, etape)
  return etape[idx]
}

async function deleteEtapaProductie(id) {
  ensureSeeded()
  const etape = readJSON(KEYS.etape_productie, [])
  const ramase = etape
    .filter((e) => e.id !== id)
    .sort((a, b) => a.ordine - b.ordine)
    .map((e, i) => ({ ...e, ordine: i + 1 }))
  writeJSON(KEYS.etape_productie, ramase)
  return ramase
}

async function reordoneazaEtapeProductie(idsInOrdine) {
  ensureSeeded()
  const etape = readJSON(KEYS.etape_productie, [])
  const byId = new Map(etape.map((e) => [e.id, e]))
  const reordonate = idsInOrdine
    .map((id, i) => {
      const e = byId.get(id)
      return e ? { ...e, ordine: i + 1 } : null
    })
    .filter(Boolean)
  writeJSON(KEYS.etape_productie, reordonate)
  return reordonate
}

async function getTehnicieni() {
  ensureSeeded()
  return readJSON(KEYS.tehnicieni, [])
}

async function addTehnician({ nume, roluri }) {
  ensureSeeded()
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele tehnicianului nu poate fi gol')
  const tehnicieni = readJSON(KEYS.tehnicieni, [])
  const tehnician = { id: uuid(), nume: valoare, roluri: Array.isArray(roluri) ? roluri : [] }
  tehnicieni.push(tehnician)
  writeJSON(KEYS.tehnicieni, tehnicieni)
  return tehnician
}

async function updateTehnician(id, patch) {
  ensureSeeded()
  const tehnicieni = readJSON(KEYS.tehnicieni, [])
  const idx = tehnicieni.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error(`Tehnicianul cu id ${id} nu a fost găsit`)
  const nume = patch.nume !== undefined ? String(patch.nume).trim() : tehnicieni[idx].nume
  if (!nume) throw new Error('Numele tehnicianului nu poate fi gol')
  const roluri = patch.roluri !== undefined ? patch.roluri : tehnicieni[idx].roluri
  tehnicieni[idx] = { ...tehnicieni[idx], nume, roluri }
  writeJSON(KEYS.tehnicieni, tehnicieni)
  return tehnicieni[idx]
}

async function deleteTehnician(id) {
  ensureSeeded()
  const tehnicieni = readJSON(KEYS.tehnicieni, [])
  writeJSON(KEYS.tehnicieni, tehnicieni.filter((t) => t.id !== id))
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

      const builtRand = buildLucrare({
        nr_inregistrare,
        clinica: row.clinica,
        medic: row.medic,
        pacient: row.pacient,
        tip_lucrare: row.tip_lucrare,
        dinti,
        nr_elemente: row.nr_elemente,
        culoare: row.culoare,
        implant: row.implant === 'true' || row.implant === true || row.implant === '1',
        try_in: row.try_in === 'true' || row.try_in === true || row.try_in === '1',
        model: row.model,
        data_intrare: row.data_intrare,
        termen_predare: row.termen_predare,
        ora_programare: row.ora_programare,
        next_date: row.next_date,
        nota: row.nota,
      })
      const lucrare = {
        ...builtRand,
        ...getSnapshotFinanciar(builtRand.tip_lucrare),
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
  getEtapeProductie,
  addEtapaProductie,
  deleteEtapaProductie,
  reordoneazaEtapeProductie,
  updateEtapaDurata,
  getTehnicieni,
  addTehnician,
  updateTehnician,
  deleteTehnician,
  getTipuriLucrareDetaliate,
  updateTipLucrareCosturi,
  addTipLucrare,
  renameTipLucrare,
  deleteTipLucrare,
  getComisioane,
  setComisiune,
  getProductieLucrare,
  getProductieTehnician,
  getToateAlocarile,
  setProductieAlocare,
  getPozeLucrare,
  addPozaLucrare,
  deletePozaLucrare,
  getLinkuriLucrare,
  addLinkLucrare,
  deleteLinkLucrare,
}
