// Implementare Supabase a stratului de acces la date — aceeași interfață
// (funcții cu aceleași nume/semnături) ca vechea implementare locală
// (`localStorageAdapter.js`), astfel încât restul aplicației (vezi
// `dataService.js`) nu s-a schimbat deloc. Structura urmează exact
// `schema.sql` din rădăcina proiectului.

import { supabase } from './supabaseClient'
import { azi as todayISO } from '../utils/date'

function fail(error, mesaj) {
  if (error) throw new Error(mesaj ? `${mesaj}: ${error.message}` : error.message)
}

// Postgres refuză un șir gol ('') pentru coloane `date`/`time` (eroare de
// tip, nu doar o valoare "goală" acceptată ca la localStorage) — golește-le
// în `null` înainte de trimitere, ca butonul „Șterge" din DatePicker/
// TimePicker să poată curăța o dată fără să pice cererea.
function golAsNull(payload, campuri) {
  const curatat = { ...payload }
  for (const camp of campuri) {
    if (curatat[camp] === '') curatat[camp] = null
  }
  return curatat
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

// ---------------------------------------------------------------------------
// Lucrări
// ---------------------------------------------------------------------------

async function generateNrInregistrare() {
  const { data, error } = await supabase.from('lucrari').select('nr_inregistrare')
  fail(error, 'Nu s-au putut citi numerele de înregistrare existente')
  let max = 0
  for (const l of data || []) {
    const m = /^AA-(\d+)$/.exec(l.nr_inregistrare || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `AA-${String(max + 1).padStart(3, '0')}`
}

async function getLucrari() {
  const { data, error } = await supabase.from('lucrari').select('*').order('created_at', { ascending: true })
  fail(error, 'Nu s-au putut încărca lucrările')
  return data || []
}

function buildLucrareInput(input, nr_inregistrare) {
  const dinti = normalizeDinti(input.dinti)
  return {
    nr_inregistrare,
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
    model: input.model || null,
    data_intrare: input.data_intrare || todayISO(),
    termen_predare: input.termen_predare || null,
    ora_programare: input.ora_programare || null,
    next_date: input.next_date || null,
    nota: input.nota || '',
  }
}

// Instantaneu financiar copiat pe o lucrare la momentul înregistrării —
// modificările ulterioare din Setup (cost/încasare/comisioane) nu mai ating
// lucrările deja create.
async function getSnapshotFinanciar(tipLucrareNume) {
  const [
    { data: tipuri, error: e1 },
    { data: etape, error: e2 },
    { data: comisioaneRaw, error: e3 },
  ] = await Promise.all([
    supabase.from('tipuri_lucrare').select('cost_laborator, incasare').eq('nume', tipLucrareNume).maybeSingle(),
    supabase.from('etape_productie').select('id, nume'),
    supabase.from('comisioane').select('etapa_id, suma').eq('tip_lucrare', tipLucrareNume),
  ])
  fail(e1 || e2 || e3, 'Nu s-a putut calcula instantaneul financiar')

  const cost_laborator = tipuri ? Number(tipuri.cost_laborator) || 0 : 0
  const incasare = tipuri ? Number(tipuri.incasare) || 0 : 0
  const etapeById = new Map((etape || []).map((e) => [e.id, e]))
  const comisioane = (comisioaneRaw || []).map((c) => ({
    etapa_id: c.etapa_id,
    etapa_nume: etapeById.get(c.etapa_id)?.nume || '',
    suma: c.suma,
  }))

  return { cost_laborator, incasare, profit: incasare - cost_laborator, comisioane }
}

async function addLucrare(input) {
  const nr_inregistrare = input.nr_inregistrare || (await generateNrInregistrare())
  const built = buildLucrareInput(input, nr_inregistrare)
  const snapshot = await getSnapshotFinanciar(built.tip_lucrare)
  const { data, error } = await supabase
    .from('lucrari')
    .insert({ ...built, ...snapshot })
    .select()
    .single()
  fail(error, 'Nu s-a putut înregistra lucrarea')
  return data
}

async function updateLucrare(id, patch) {
  let payload = golAsNull(patch, ['data_intrare', 'termen_predare', 'ora_programare', 'next_date'])
  if (payload.dinti !== undefined) payload = { ...payload, dinti: normalizeDinti(payload.dinti) }
  const { data, error } = await supabase.from('lucrari').update(payload).eq('id', id).select().single()
  fail(error, `Nu s-a putut actualiza lucrarea ${id}`)
  return data
}

// `on delete cascade` în schema.sql curăță automat productie_lucrare,
// poze_lucrare și linkuri_lucrare pentru această lucrare.
async function deleteLucrare(id) {
  const { error } = await supabase.from('lucrari').delete().eq('id', id)
  fail(error, `Nu s-a putut șterge lucrarea ${id}`)
}

async function importLucrari(rows) {
  const [{ data: existente, error: e0 }] = await Promise.all([supabase.from('lucrari').select('nr_inregistrare')])
  fail(e0, 'Nu s-au putut citi lucrările existente')
  const existingNr = new Set((existente || []).map((l) => l.nr_inregistrare))

  const snapshotCache = new Map()
  async function snapshotPentru(tip) {
    if (!snapshotCache.has(tip)) snapshotCache.set(tip, await getSnapshotFinanciar(tip))
    return snapshotCache.get(tip)
  }

  const deInserat = []
  const erori = []
  let maxNr = 0
  for (const nr of existingNr) {
    const m = /^AA-(\d+)$/.exec(nr || '')
    if (m) maxNr = Math.max(maxNr, parseInt(m[1], 10))
  }

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
        maxNr += 1
        nr_inregistrare = `AA-${String(maxNr).padStart(3, '0')}`
      }

      const built = buildLucrareInput(
        {
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
        },
        nr_inregistrare
      )
      const snapshot = await snapshotPentru(built.tip_lucrare)

      deInserat.push({ ...built, ...snapshot })
      existingNr.add(nr_inregistrare)
    } catch (err) {
      erori.push({ rand: rowNr, motiv: err.message })
    }
  }

  if (deInserat.length > 0) {
    const { error } = await supabase.from('lucrari').insert(deInserat)
    fail(error, 'Nu s-au putut importa lucrările')
  }

  return { importate: deInserat.length, sarite: erori.length, erori }
}

// ---------------------------------------------------------------------------
// Liste de configurare simple (culori, medici, clinici) — tabele cu un
// singur câmp relevant (`nume`); interfața existentă lucrează cu string-uri
// simple, nu cu rândurile întregi.
// ---------------------------------------------------------------------------

const TABEL_CONFIG_SIMPLU = {
  culori: 'culori',
  medici: 'medici',
  clinici: 'clinici',
}

async function getConfigList(tip) {
  if (tip === 'tipuri_lucrare') {
    const { data, error } = await supabase.from('tipuri_lucrare').select('nume').order('created_at')
    fail(error, 'Nu s-au putut încărca tipurile de lucrare')
    return (data || []).map((t) => t.nume)
  }
  const tabel = TABEL_CONFIG_SIMPLU[tip]
  if (!tabel) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  const { data, error } = await supabase.from(tabel).select('nume').order('created_at')
  fail(error, `Nu s-a putut încărca lista „${tip}”`)
  return (data || []).map((r) => r.nume)
}

async function addConfigValue(tip, nume) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Valoarea nu poate fi goală')

  if (tip === 'tipuri_lucrare') {
    const { data: existent, error: e1 } = await supabase
      .from('tipuri_lucrare')
      .select('id')
      .ilike('nume', valoare)
      .maybeSingle()
    fail(e1, 'Nu s-a putut verifica tipul de lucrare')
    if (!existent) {
      const { error } = await supabase.from('tipuri_lucrare').insert({ nume: valoare, cost_laborator: 0, incasare: 0 })
      fail(error, 'Nu s-a putut adăuga tipul de lucrare')
    }
    return valoare
  }

  const tabel = TABEL_CONFIG_SIMPLU[tip]
  if (!tabel) throw new Error(`Listă de configurare necunoscută: ${tip}`)
  const { error } = await supabase.from(tabel).upsert({ nume: valoare }, { onConflict: 'nume', ignoreDuplicates: true })
  fail(error, `Nu s-a putut adăuga în lista „${tip}”`)
  return valoare
}

// ---------------------------------------------------------------------------
// Tipuri de lucrare (admin complet — Setup)
// ---------------------------------------------------------------------------

async function getTipuriLucrareDetaliate() {
  const { data, error } = await supabase.from('tipuri_lucrare').select('*').order('created_at')
  fail(error, 'Nu s-au putut încărca tipurile de lucrare')
  return data || []
}

async function updateTipLucrareCosturi(id, { cost_laborator, incasare }) {
  const payload = {
    cost_laborator: cost_laborator === '' || cost_laborator == null ? 0 : Number(cost_laborator),
    incasare: incasare === '' || incasare == null ? 0 : Number(incasare),
  }
  const { data, error } = await supabase.from('tipuri_lucrare').update(payload).eq('id', id).select().single()
  fail(error, `Nu s-au putut actualiza costurile tipului de lucrare ${id}`)
  return data
}

async function addTipLucrare(nume) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele tipului de lucrare nu poate fi gol')
  const { data: existent, error: e1 } = await supabase
    .from('tipuri_lucrare')
    .select('id')
    .ilike('nume', valoare)
    .maybeSingle()
  fail(e1, 'Nu s-a putut verifica tipul de lucrare')
  if (existent) throw new Error(`Tipul de lucrare „${valoare}” există deja`)
  const { data, error } = await supabase
    .from('tipuri_lucrare')
    .insert({ nume: valoare, cost_laborator: 0, incasare: 0 })
    .select()
    .single()
  fail(error, 'Nu s-a putut adăuga tipul de lucrare')
  return data
}

// Redenumește un tip de lucrare și propagă noul nume în grila de comisioane
// (cheia acolo e numele, nu id-ul). Lucrările deja înregistrate NU se ating —
// `lucrari.tip_lucrare` e un instantaneu de text de la momentul înregistrării.
async function renameTipLucrare(id, numeNou) {
  const valoare = String(numeNou || '').trim()
  if (!valoare) throw new Error('Numele tipului de lucrare nu poate fi gol')

  const { data: curent, error: e1 } = await supabase.from('tipuri_lucrare').select('nume').eq('id', id).single()
  fail(e1, `Tipul de lucrare cu id ${id} nu a fost găsit`)
  if (curent.nume === valoare) return { id, ...curent }

  const { data: duplicat, error: e2 } = await supabase
    .from('tipuri_lucrare')
    .select('id')
    .ilike('nume', valoare)
    .neq('id', id)
    .maybeSingle()
  fail(e2, 'Nu s-a putut verifica tipul de lucrare')
  if (duplicat) throw new Error(`Tipul de lucrare „${valoare}” există deja`)

  const { data, error } = await supabase.from('tipuri_lucrare').update({ nume: valoare }).eq('id', id).select().single()
  fail(error, 'Nu s-a putut redenumi tipul de lucrare')

  const { error: e3 } = await supabase.from('comisioane').update({ tip_lucrare: valoare }).eq('tip_lucrare', curent.nume)
  fail(e3, 'Tipul a fost redenumit, dar grila de comisioane nu s-a putut actualiza')

  return data
}

// Șterge tipul de lucrare din configurare — lucrările deja înregistrate cu
// acest tip își păstrează valoarea. Rândurile de comisioane asociate se șterg
// și ele (nu mai au sens fără tipul de lucrare).
async function deleteTipLucrare(id) {
  const { data: tip, error: e1 } = await supabase.from('tipuri_lucrare').select('nume').eq('id', id).maybeSingle()
  fail(e1, 'Nu s-a putut citi tipul de lucrare')
  const { error } = await supabase.from('tipuri_lucrare').delete().eq('id', id)
  fail(error, 'Nu s-a putut șterge tipul de lucrare')
  if (tip) {
    const { error: e2 } = await supabase.from('comisioane').delete().eq('tip_lucrare', tip.nume)
    fail(e2, 'Tipul a fost șters, dar comisioanele asociate nu s-au putut curăța')
  }
}

// ---------------------------------------------------------------------------
// Comisioane
// ---------------------------------------------------------------------------

async function getComisioane() {
  const { data, error } = await supabase.from('comisioane').select('*')
  fail(error, 'Nu s-a putut încărca grila de comisioane')
  return data || []
}

async function setComisiune(tipLucrare, etapaId, suma) {
  const valoare = suma === '' || suma == null ? 0 : Number(suma)
  const { data, error } = await supabase
    .from('comisioane')
    .upsert({ tip_lucrare: tipLucrare, etapa_id: etapaId, suma: valoare }, { onConflict: 'tip_lucrare,etapa_id' })
    .select()
    .single()
  fail(error, 'Nu s-a putut salva comisionul')
  return data
}

// ---------------------------------------------------------------------------
// Producție / alocări
// ---------------------------------------------------------------------------

async function getProductieLucrare(lucrareId) {
  const { data, error } = await supabase.from('productie_lucrare').select('*').eq('lucrare_id', lucrareId)
  fail(error, 'Nu s-au putut încărca etapele de producție ale lucrării')
  return data || []
}

async function getProductieTehnician(tehnicianId) {
  const { data, error } = await supabase.from('productie_lucrare').select('*').eq('tehnician_id', tehnicianId)
  fail(error, 'Nu s-au putut încărca sarcinile tehnicianului')
  return data || []
}

async function getToateAlocarile() {
  const { data, error } = await supabase.from('productie_lucrare').select('*')
  fail(error, 'Nu s-au putut încărca alocările de producție')
  return data || []
}

async function setProductieAlocare(lucrareId, etapaId, patch) {
  const row = { lucrare_id: lucrareId, etapa_id: etapaId, ...golAsNull(patch, ['data_planificata', 'data_finalizare']) }
  const { data, error } = await supabase
    .from('productie_lucrare')
    .upsert(row, { onConflict: 'lucrare_id,etapa_id' })
    .select()
    .single()
  fail(error, 'Nu s-a putut salva alocarea de producție')
  return data
}

// ---------------------------------------------------------------------------
// Galerie — poze și link-uri
// ---------------------------------------------------------------------------

async function getPozeLucrare(lucrareId) {
  const { data, error } = await supabase
    .from('poze_lucrare')
    .select('*')
    .eq('lucrare_id', lucrareId)
    .order('data_incarcare', { ascending: false })
  fail(error, 'Nu s-au putut încărca pozele lucrării')
  return data || []
}

// `referinta_fisier` e deocamdată un data URL base64, stocat direct în
// coloană (vezi nota din schema.sql) — mutarea în Supabase Storage e o
// îmbunătățire ulterioară, nu parte din runda asta.
async function addPozaLucrare(lucrareId, { numeFisier, referintaFisier }) {
  if (!referintaFisier) throw new Error('Fișierul imaginii lipsește')
  const { data, error } = await supabase
    .from('poze_lucrare')
    .insert({ lucrare_id: lucrareId, nume_fisier: numeFisier || '', referinta_fisier: referintaFisier })
    .select()
    .single()
  fail(error, 'Nu s-a putut încărca poza')
  return data
}

async function deletePozaLucrare(id) {
  const { error } = await supabase.from('poze_lucrare').delete().eq('id', id)
  fail(error, 'Nu s-a putut șterge poza')
}

async function getLinkuriLucrare(lucrareId) {
  const { data, error } = await supabase
    .from('linkuri_lucrare')
    .select('*')
    .eq('lucrare_id', lucrareId)
    .order('data_adaugare', { ascending: false })
  fail(error, 'Nu s-au putut încărca link-urile lucrării')
  return data || []
}

async function addLinkLucrare(lucrareId, { url, eticheta }) {
  if (!url) throw new Error('URL-ul lipsește')
  const { data, error } = await supabase
    .from('linkuri_lucrare')
    .insert({ lucrare_id: lucrareId, url, eticheta: eticheta || '' })
    .select()
    .single()
  fail(error, 'Nu s-a putut adăuga link-ul')
  return data
}

async function deleteLinkLucrare(id) {
  const { error } = await supabase.from('linkuri_lucrare').delete().eq('id', id)
  fail(error, 'Nu s-a putut șterge link-ul')
}

// ---------------------------------------------------------------------------
// Etape de producție
// ---------------------------------------------------------------------------

async function getEtapeProductie() {
  const { data, error } = await supabase.from('etape_productie').select('*').order('ordine', { ascending: true })
  fail(error, 'Nu s-au putut încărca etapele de producție')
  return data || []
}

async function addEtapaProductie(nume) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele etapei nu poate fi gol')
  const { data: etape, error: e1 } = await supabase.from('etape_productie').select('nume, ordine')
  fail(e1, 'Nu s-au putut citi etapele existente')
  if ((etape || []).some((e) => e.nume.toLowerCase() === valoare.toLowerCase())) {
    throw new Error(`Etapa „${valoare}” există deja`)
  }
  const ordine = (etape || []).reduce((max, e) => Math.max(max, e.ordine), 0) + 1
  const { data, error } = await supabase
    .from('etape_productie')
    .insert({ nume: valoare, ordine, durata_minute: 0 })
    .select()
    .single()
  fail(error, 'Nu s-a putut adăuga etapa')
  return data
}

async function updateEtapaDurata(id, durataMinute) {
  const valoare = durataMinute === '' || durataMinute == null ? 0 : Number(durataMinute)
  const { data, error } = await supabase
    .from('etape_productie')
    .update({ durata_minute: Number.isFinite(valoare) && valoare >= 0 ? valoare : 0 })
    .eq('id', id)
    .select()
    .single()
  fail(error, `Nu s-a putut actualiza durata etapei ${id}`)
  return data
}

async function deleteEtapaProductie(id) {
  const { error: e1 } = await supabase.from('etape_productie').delete().eq('id', id)
  fail(e1, 'Nu s-a putut șterge etapa')

  const { data: ramase, error: e2 } = await supabase
    .from('etape_productie')
    .select('id, ordine')
    .order('ordine', { ascending: true })
  fail(e2, 'Etapa a fost ștearsă, dar renumerotarea ordinii a eșuat')

  const reordonate = (ramase || []).map((e, i) => ({ id: e.id, ordine: i + 1 }))
  for (const r of reordonate) {
    const { error } = await supabase.from('etape_productie').update({ ordine: r.ordine }).eq('id', r.id)
    fail(error, 'Nu s-a putut renumerota ordinea etapelor')
  }

  const { data, error: e3 } = await supabase.from('etape_productie').select('*').order('ordine', { ascending: true })
  fail(e3, 'Nu s-au putut reîncărca etapele')
  return data || []
}

async function reordoneazaEtapeProductie(idsInOrdine) {
  for (let i = 0; i < idsInOrdine.length; i++) {
    const { error } = await supabase.from('etape_productie').update({ ordine: i + 1 }).eq('id', idsInOrdine[i])
    fail(error, 'Nu s-a putut salva noua ordine a etapelor')
  }
  const { data, error } = await supabase.from('etape_productie').select('*').order('ordine', { ascending: true })
  fail(error, 'Nu s-au putut reîncărca etapele')
  return data || []
}

// ---------------------------------------------------------------------------
// Tehnicieni
// ---------------------------------------------------------------------------

async function getTehnicieni() {
  const { data, error } = await supabase.from('tehnicieni').select('*').order('nume', { ascending: true })
  fail(error, 'Nu s-au putut încărca tehnicienii')
  return data || []
}

async function addTehnician({ nume, roluri }) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele tehnicianului nu poate fi gol')
  const { data, error } = await supabase
    .from('tehnicieni')
    .insert({ nume: valoare, roluri: Array.isArray(roluri) ? roluri : [] })
    .select()
    .single()
  fail(error, 'Nu s-a putut adăuga tehnicianul')
  return data
}

async function updateTehnician(id, patch) {
  const payload = {}
  if (patch.nume !== undefined) {
    const nume = String(patch.nume).trim()
    if (!nume) throw new Error('Numele tehnicianului nu poate fi gol')
    payload.nume = nume
  }
  if (patch.roluri !== undefined) payload.roluri = patch.roluri
  const { data, error } = await supabase.from('tehnicieni').update(payload).eq('id', id).select().single()
  fail(error, `Nu s-a putut actualiza tehnicianul ${id}`)
  return data
}

async function deleteTehnician(id) {
  const { error } = await supabase.from('tehnicieni').delete().eq('id', id)
  fail(error, 'Nu s-a putut șterge tehnicianul')
}

export const supabaseAdapter = {
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
