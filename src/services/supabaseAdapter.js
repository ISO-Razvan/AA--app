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
      if (typeof d === 'number') return { numar: d, grup: null, implant: false }
      if (d && typeof d === 'object' && typeof d.numar === 'number') {
        return { numar: d.numar, grup: d.grup ?? null, implant: d.implant === true }
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

// Preț PER ELEMENT pentru un tip de lucrare — cost_laborator/încasare/
// pret_implant din `tipuri_lucrare` și fiecare sumă din grila de comisioane
// sunt definite per element, nu per lucrare. Rezultatul final de pus pe o
// lucrare se obține mereu prin `calculeazaInstantaneu` de mai jos.
async function getSnapshotPerElement(tipLucrareNume) {
  const [
    { data: tipuri, error: e1 },
    { data: etape, error: e2 },
    { data: comisioaneRaw, error: e3 },
  ] = await Promise.all([
    supabase.from('tipuri_lucrare').select('*').eq('nume', tipLucrareNume).maybeSingle(),
    supabase.from('etape_productie').select('id, nume'),
    supabase.from('comisioane').select('etapa_id, suma').eq('tip_lucrare', tipLucrareNume),
  ])
  fail(e1 || e2 || e3, 'Nu s-a putut calcula instantaneul financiar')

  const cost_laborator = tipuri ? Number(tipuri.cost_laborator) || 0 : 0
  const incasare = tipuri ? Number(tipuri.incasare) || 0 : 0
  const pret_implant = tipuri ? Number(tipuri.pret_implant) || 0 : 0
  const etapeById = new Map((etape || []).map((e) => [e.id, e]))
  const comisioane = (comisioaneRaw || []).map((c) => ({
    etapa_id: c.etapa_id,
    etapa_nume: etapeById.get(c.etapa_id)?.nume || '',
    suma: Number(c.suma) || 0,
  }))

  return { cost_laborator, incasare, pret_implant, comisioane }
}

// Instantaneu financiar final de pe o lucrare.
// Dinți: elemente simple × incasare + elemente pe implant × pret_implant;
// elementele simple sunt nr_elemente minus dinții marcați pe implant (deci și
// intermediarii de punte și elementele nemarcate pe schemă). Costul dinților
// și comisioanele rămân preț per element × nr_elemente.
// Extra-uri (inclusiv Try-in, dacă e bifat): Σ cantitate × preț/cost unitar
// din instantaneul fiecărui extra de pe lucrare. Comisioanele nu le includ.
// `nr_elemente` e normalizat la număr ca să nu se strecoare un string.
function calculeazaInstantaneu(snapshotPerElement, nrElemente, dinti, extraUri) {
  const n = Number(nrElemente) || 0
  const nImplant = Math.min(n, (dinti || []).filter((d) => d && d.implant === true).length)
  const nSimplu = n - nImplant
  const extra = extraUri || []
  const incasareExtra = extra.reduce((s, e) => s + (Number(e.cantitate) || 0) * (Number(e.pret_unitar) || 0), 0)
  const costExtra = extra.reduce((s, e) => s + (Number(e.cantitate) || 0) * (Number(e.cost_unitar) || 0), 0)
  const cost_laborator = snapshotPerElement.cost_laborator * n + costExtra
  const incasare = snapshotPerElement.incasare * nSimplu + snapshotPerElement.pret_implant * nImplant + incasareExtra
  const comisioane = snapshotPerElement.comisioane.map((c) => ({ ...c, suma: c.suma * n }))
  return {
    cost_laborator,
    incasare,
    profit: incasare - cost_laborator,
    comisioane,
    pret_dinte_simplu: snapshotPerElement.incasare,
    pret_dinte_implant: snapshotPerElement.pret_implant,
  }
}

// ---------------------------------------------------------------------------
// Extra-uri — configurare (Setup) + instantaneul lor pe lucrare
// ---------------------------------------------------------------------------

const SISTEM_TRY_IN = 'try_in'

async function getExtraUri() {
  const { data, error } = await supabase.from('extra_uri').select('*').order('created_at')
  fail(error, 'Nu s-au putut încărca extra-urile')
  // Rândurile de sistem (Try-in) primele.
  return (data || []).sort((a, b) => (b.sistem ? 1 : 0) - (a.sistem ? 1 : 0))
}

async function getExtraSetup() {
  const lista = await getExtraUri()
  return {
    byId: new Map(lista.map((e) => [e.id, e])),
    tryIn: lista.find((e) => e.sistem === SISTEM_TRY_IN) || null,
  }
}

function numarSauZero(v) {
  return v === '' || v == null ? 0 : Number(v) || 0
}

// Extra-urile alese (fără Try-in) dintr-un array salvat pe lucrare.
function selectieDinExtraUri(extraUri, extraSetup) {
  const tryInId = extraSetup.tryIn?.id
  return (extraUri || []).filter((e) => e.extra_id !== tryInId).map((e) => ({ extra_id: e.extra_id, cantitate: e.cantitate }))
}

// Construiește array-ul `extra_uri` de salvat pe lucrare, din selecția
// curentă [{ extra_id, cantitate }] + bifa Try-in. Un extra deja prezent pe
// lucrare își păstrează prețul/costul din instantaneu; unul nou (sau Try-in
// bifat acum) preia prețul/costul curent din Setup. Cu `preturiCurente`
// (butonul „Recalculează"), toate primesc prețurile curente din Setup.
function construiesteExtraUri({ selectie, existente, tryIn, extraSetup, preturiCurente = false }) {
  const vechi = existente || []
  const element = (extraId, cantitateCeruta) => {
    const existent = vechi.find((e) => e.extra_id === extraId)
    const setup = extraSetup.byId.get(extraId)
    if (!existent && !setup) return null
    const dinSetup = setup && (preturiCurente || !existent)
    const mod_taxare = setup?.mod_taxare ?? existent.mod_taxare
    return {
      extra_id: extraId,
      nume: setup?.nume ?? existent.nume,
      cantitate: mod_taxare === 'per_bucata' ? Math.max(1, Math.round(Number(cantitateCeruta) || 1)) : 1,
      pret_unitar: dinSetup ? numarSauZero(setup.pret) : numarSauZero(existent.pret_unitar),
      cost_unitar: dinSetup ? numarSauZero(setup.cost_laborator) : numarSauZero(existent.cost_unitar),
      mod_taxare,
    }
  }

  const rezultat = []
  if (tryIn && extraSetup.tryIn) rezultat.push(element(extraSetup.tryIn.id, 1))
  for (const s of selectie || []) {
    if (s.extra_id === extraSetup.tryIn?.id) continue
    if (rezultat.some((e) => e && e.extra_id === s.extra_id)) continue
    rezultat.push(element(s.extra_id, s.cantitate))
  }
  return rezultat.filter(Boolean)
}

async function addExtra({ nume, pret, cost_laborator, mod_taxare }) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Numele extra-ului nu poate fi gol')
  if (!['per_comanda', 'per_bucata'].includes(mod_taxare)) throw new Error('Mod de taxare invalid')
  const { data: existent, error: e1 } = await supabase.from('extra_uri').select('id').ilike('nume', valoare).maybeSingle()
  fail(e1, 'Nu s-a putut verifica extra-ul')
  if (existent) throw new Error(`Extra-ul „${valoare}” există deja`)
  const { data, error } = await supabase
    .from('extra_uri')
    .insert({ nume: valoare, pret: numarSauZero(pret), cost_laborator: numarSauZero(cost_laborator), mod_taxare })
    .select()
    .single()
  fail(error, 'Nu s-a putut adăuga extra-ul')
  return data
}

// La un rând de sistem (Try-in) se pot modifica doar prețul și costul.
async function updateExtra(id, patch) {
  const { data: curent, error: e0 } = await supabase.from('extra_uri').select('sistem').eq('id', id).single()
  fail(e0, 'Extra-ul nu a fost găsit')
  const payload = {}
  if ('pret' in patch) payload.pret = numarSauZero(patch.pret)
  if ('cost_laborator' in patch) payload.cost_laborator = numarSauZero(patch.cost_laborator)
  if (!curent.sistem) {
    if ('nume' in patch) {
      const valoare = String(patch.nume || '').trim()
      if (!valoare) throw new Error('Numele extra-ului nu poate fi gol')
      const { data: dup, error: e1 } = await supabase.from('extra_uri').select('id').ilike('nume', valoare).neq('id', id).maybeSingle()
      fail(e1, 'Nu s-a putut verifica extra-ul')
      if (dup) throw new Error(`Extra-ul „${valoare}” există deja`)
      payload.nume = valoare
    }
    if ('mod_taxare' in patch) {
      if (!['per_comanda', 'per_bucata'].includes(patch.mod_taxare)) throw new Error('Mod de taxare invalid')
      payload.mod_taxare = patch.mod_taxare
    }
    if ('activ' in patch) payload.activ = !!patch.activ
  }
  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabase.from('extra_uri').select('*').eq('id', id).single()
    fail(error, 'Nu s-a putut citi extra-ul')
    return data
  }
  const { data, error } = await supabase.from('extra_uri').update(payload).eq('id', id).select().single()
  fail(error, 'Nu s-a putut actualiza extra-ul')
  return data
}

async function addLucrare(input) {
  const nr_inregistrare = input.nr_inregistrare || (await generateNrInregistrare())
  const built = buildLucrareInput(input, nr_inregistrare)
  const [perElement, extraSetup] = await Promise.all([getSnapshotPerElement(built.tip_lucrare), getExtraSetup()])
  const extra_uri = construiesteExtraUri({ selectie: input.extra_uri, existente: [], tryIn: built.try_in, extraSetup })
  const snapshot = calculeazaInstantaneu(perElement, built.nr_elemente, built.dinti, extra_uri)
  const { data, error } = await supabase
    .from('lucrari')
    .insert({ ...built, extra_uri, ...snapshot })
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

// Ca updateLucrare, dar recalculează și instantaneul financiar al ACESTEI
// lucrări, în același update: dinții cu prețurile curente din Setup,
// extra-urile cu prețul din instantaneul lor (cele nou adăugate / Try-in
// bifat acum — cu prețul curent). Folosit doar când un admin modifică din
// fișă dinții, marcajele de implant, extra-urile sau bifa Try-in.
// `patch.extra_uri`, dacă e prezent, e selecția [{ extra_id, cantitate }].
async function updateLucrareSiRecalculeaza(id, patch) {
  const { data: curenta, error: e0 } = await supabase
    .from('lucrari')
    .select('tip_lucrare, nr_elemente, dinti, try_in, extra_uri')
    .eq('id', id)
    .single()
  fail(e0, `Nu s-a putut citi lucrarea ${id}`)
  const dinti = patch.dinti !== undefined ? normalizeDinti(patch.dinti) : curenta.dinti
  const nrElemente = patch.nr_elemente !== undefined ? patch.nr_elemente : curenta.nr_elemente
  const tip = patch.tip_lucrare !== undefined ? patch.tip_lucrare : curenta.tip_lucrare
  const tryIn = patch.try_in !== undefined ? !!patch.try_in : curenta.try_in
  const [perElement, extraSetup] = await Promise.all([getSnapshotPerElement(tip), getExtraSetup()])
  const extra_uri = construiesteExtraUri({
    selectie: patch.extra_uri !== undefined ? patch.extra_uri : selectieDinExtraUri(curenta.extra_uri, extraSetup),
    existente: curenta.extra_uri,
    tryIn,
    extraSetup,
  })
  const snapshot = calculeazaInstantaneu(perElement, nrElemente, dinti, extra_uri)
  return updateLucrare(id, { ...patch, extra_uri, ...snapshot })
}

// `on delete cascade` în schema.sql curăță automat productie_lucrare,
// poze_lucrare și linkuri_lucrare pentru această lucrare.
async function deleteLucrare(id) {
  const { error } = await supabase.from('lucrari').delete().eq('id', id)
  fail(error, `Nu s-a putut șterge lucrarea ${id}`)
}

// Tabelele golite de „Șterge toate lucrările", de la copii spre părinți.
// Deși schema are `on delete cascade`, le ștergem explicit pe toate: baza
// live poate fi creată înainte de cascade, iar ordinea asta merge oricum.
// Configurarea (etape, tehnicieni, tipuri, comisioane, extra_uri, clinici,
// medici, culori, profiles) nu e atinsă.
const TABELE_DATE_LUCRARI = ['deviz_lucrari', 'devize', 'productie_lucrare', 'poze_lucrare', 'linkuri_lucrare', 'lucrari']

async function numaraRanduri(tabel) {
  const { count, error } = await supabase.from(tabel).select('id', { count: 'exact', head: true })
  fail(error, `Nu s-au putut număra rândurile din ${tabel}`)
  return count || 0
}

async function numaraLucrariSiDevize() {
  const [lucrari, devize] = await Promise.all([numaraRanduri('lucrari'), numaraRanduri('devize')])
  return { lucrari, devize }
}

async function stergeToateLucrarile() {
  const inainte = await numaraLucrariSiDevize()
  for (const tabel of TABELE_DATE_LUCRARI) {
    // Supabase refuză un delete fără filtru — acesta acoperă toate rândurile.
    const { error } = await supabase.from(tabel).delete().not('id', 'is', null)
    fail(error, `Nu s-a putut goli tabelul ${tabel}`)
  }
  // RLS poate bloca ștergerea fără eroare (0 rânduri afectate) — verificăm.
  const ramase = []
  for (const tabel of TABELE_DATE_LUCRARI) {
    const n = await numaraRanduri(tabel)
    if (n > 0) ramase.push(`${tabel} (${n})`)
  }
  if (ramase.length > 0) throw new Error(`Ștergerea nu s-a finalizat — au rămas rânduri în: ${ramase.join(', ')}`)
  return inainte
}

async function importLucrari(rows) {
  const [{ data: existente, error: e0 }] = await Promise.all([supabase.from('lucrari').select('nr_inregistrare')])
  fail(e0, 'Nu s-au putut citi lucrările existente')
  const existingNr = new Set((existente || []).map((l) => l.nr_inregistrare))
  const extraSetup = await getExtraSetup()

  // Prețul per element se poate cache-ui pe tip (nu depinde de lucrare), dar
  // înmulțirea cu nr_elemente trebuie făcută separat, per rând — de-aici bug-ul
  // anterior: se aplica direct prețul per element, fără să se țină cont că
  // fiecare rând poate avea un nr_elemente diferit.
  const perElementCache = new Map()
  async function perElementPentru(tip) {
    if (!perElementCache.has(tip)) perElementCache.set(tip, await getSnapshotPerElement(tip))
    return perElementCache.get(tip)
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
      const perElement = await perElementPentru(built.tip_lucrare)
      const extra_uri = construiesteExtraUri({ selectie: [], existente: [], tryIn: built.try_in, extraSetup })
      const snapshot = calculeazaInstantaneu(perElement, built.nr_elemente, built.dinti, extra_uri)

      deInserat.push({ ...built, extra_uri, ...snapshot })
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

// Recalculează instantaneul financiar (cost_laborator/incasare/comisioane,
// inclusiv extra-urile și Try-in-ul) pentru TOATE lucrările existente, cu
// prețurile curente din Setup — doar la cerere explicită (butonul din Setup →
// Tipuri de lucrare). Comportamentul implicit (instantaneu la înregistrare)
// nu se schimbă.
async function recalculeazaValoriFinanciare() {
  const { data: toateLucrarile, error: e0 } = await supabase
    .from('lucrari')
    .select('id, nr_inregistrare, tip_lucrare, nr_elemente, dinti, try_in, extra_uri')
  fail(e0, 'Nu s-au putut citi lucrările')
  const extraSetup = await getExtraSetup()

  const { data: tipuriExistente, error: e1 } = await supabase.from('tipuri_lucrare').select('nume')
  fail(e1, 'Nu s-au putut citi tipurile de lucrare')
  const tipuriSet = new Set((tipuriExistente || []).map((t) => t.nume))

  const perElementCache = new Map()
  async function perElementPentru(tip) {
    if (!perElementCache.has(tip)) perElementCache.set(tip, await getSnapshotPerElement(tip))
    return perElementCache.get(tip)
  }

  let actualizate = 0
  const sarite = []
  for (const l of toateLucrarile || []) {
    if (!tipuriSet.has(l.tip_lucrare)) {
      sarite.push(l.nr_inregistrare)
      continue
    }
    const perElement = await perElementPentru(l.tip_lucrare)
    const extra_uri = construiesteExtraUri({
      selectie: selectieDinExtraUri(l.extra_uri, extraSetup),
      existente: l.extra_uri,
      tryIn: l.try_in,
      extraSetup,
      preturiCurente: true,
    })
    const snapshot = calculeazaInstantaneu(perElement, l.nr_elemente, l.dinti, extra_uri)
    const { error } = await supabase.from('lucrari').update({ extra_uri, ...snapshot }).eq('id', l.id)
    fail(error, `Nu s-a putut actualiza lucrarea ${l.nr_inregistrare}`)
    actualizate++
  }

  return { actualizate, sarite }
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

async function updateTipLucrareCosturi(id, { cost_laborator, incasare, pret_implant }) {
  const payload = {
    cost_laborator: cost_laborator === '' || cost_laborator == null ? 0 : Number(cost_laborator),
    incasare: incasare === '' || incasare == null ? 0 : Number(incasare),
    pret_implant: pret_implant === '' || pret_implant == null ? 0 : Number(pret_implant),
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

// ---------------------------------------------------------------------------
// Devize
// ---------------------------------------------------------------------------

async function generateNumarDeviz() {
  const { data, error } = await supabase.from('devize').select('numar_deviz')
  fail(error, 'Nu s-au putut citi numerele de deviz existente')
  let max = 0
  for (const d of data || []) {
    const m = /^DZ-(\d+)$/.exec(d.numar_deviz || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `DZ-${String(max + 1).padStart(3, '0')}`
}

async function getDevize() {
  const { data, error } = await supabase.from('devize').select('*').order('created_at', { ascending: false })
  fail(error, 'Nu s-au putut încărca devizele')
  return data || []
}

// Rândurile devizului, cu lucrarea asociată încorporată (join pe FK-ul
// lucrare_id) — suficient pentru previzualizare, fără un fetch separat.
async function getDevizLucrari(devizId) {
  const { data, error } = await supabase
    .from('deviz_lucrari')
    .select('*, lucrare:lucrari(*)')
    .eq('deviz_id', devizId)
  fail(error, 'Nu s-au putut încărca lucrările devizului')
  return data || []
}

// Doar lucrare_id-urile deja incluse în orice deviz — folosit ca să
// ascundem implicit, la generarea unui deviz nou, lucrările deja facturate.
async function getLucrareIdsFacturate() {
  const { data, error } = await supabase.from('deviz_lucrari').select('lucrare_id')
  fail(error, 'Nu s-a putut verifica ce lucrări sunt deja facturate')
  return (data || []).map((r) => r.lucrare_id)
}

async function creeazaDeviz({ medic, clinica, lucrari }) {
  if (!medic) throw new Error('Medicul este obligatoriu')
  if (!Array.isArray(lucrari) || lucrari.length === 0) throw new Error('Selectează cel puțin o lucrare')

  const numar_deviz = await generateNumarDeviz()
  const total = lucrari.reduce((sum, l) => sum + (Number(l.suma) || 0), 0)

  const { data: deviz, error: e1 } = await supabase
    .from('devize')
    .insert({ numar_deviz, medic, clinica: clinica || null, total })
    .select()
    .single()
  fail(e1, 'Nu s-a putut crea devizul')

  const rows = lucrari.map((l) => ({ deviz_id: deviz.id, lucrare_id: l.id, suma: Number(l.suma) || 0 }))
  const { error: e2 } = await supabase.from('deviz_lucrari').insert(rows)
  fail(e2, 'Devizul a fost creat, dar lucrările nu s-au putut asocia')

  return deviz
}

// `on delete cascade` pe deviz_lucrari.deviz_id curăță automat rândurile
// asociate — lucrările incluse redevin disponibile pentru un deviz nou.
async function deleteDeviz(id) {
  const { error } = await supabase.from('devize').delete().eq('id', id)
  fail(error, 'Nu s-a putut șterge devizul')
}

export const supabaseAdapter = {
  getLucrari,
  addLucrare,
  updateLucrare,
  updateLucrareSiRecalculeaza,
  deleteLucrare,
  numaraLucrariSiDevize,
  stergeToateLucrarile,
  getExtraUri,
  addExtra,
  updateExtra,
  getConfigList,
  addConfigValue,
  generateNrInregistrare,
  importLucrari,
  recalculeazaValoriFinanciare,
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
  getDevize,
  getDevizLucrari,
  getLucrareIdsFacturate,
  creeazaDeviz,
  deleteDeviz,
}
