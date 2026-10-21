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

// Citirea lucrărilor se face din view-ul `lucrari_vizibile` (vezi schema.sql):
// patronul primește toate coloanele; coordonatorul și tehnicianul primesc
// coloanele financiare goale, iar tehnicianul doar lucrările în care are o
// etapă alocată. Din tabelul `lucrari` se pot citi direct doar coloanele
// operaționale.
async function getLucrari() {
  const { data, error } = await supabase.from('lucrari_vizibile').select('*').order('created_at', { ascending: true })
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

// Instantaneul financiar al lucrării (cost, încasare, profit, comisioane,
// prețurile per element, adaosurile Design, prețurile extra-urilor) NU se
// calculează aici: îl face baza de date (triggerul `lucrari_instantaneu_financiar`),
// la înregistrare și la orice schimbare de tip, nr. elemente, dinți, Try-in
// sau extra-uri. Aplicația trimite doar selecția de extra-uri
// [{ extra_id, cantitate }]; Try-in-ul îl adaugă baza de date din bifă.
// Așa coordonatorul poate edita lucrări fără să poată citi prețurile.
const COLOANE_NEPERMISE = new Set([
  'id',
  'nr_inregistrare',
  'created_at',
  'cost_laborator',
  'incasare',
  'profit',
  'comisioane',
  'pret_dinte_simplu',
  'pret_dinte_implant',
  'adaosuri_design',
])

function selectieExtra(extraUri) {
  return (extraUri || []).map((e) => ({ extra_id: e.extra_id, cantitate: e.cantitate }))
}

// ---------------------------------------------------------------------------
// Extra-uri — configurare (Setup)
// ---------------------------------------------------------------------------

// Lista completă, cu prețuri — doar patronul (Setup → Extra-uri).
async function getExtraUri() {
  const { data, error } = await supabase.from('extra_uri').select('*').order('created_at')
  fail(error, 'Nu s-au putut încărca extra-urile')
  // Rândurile de sistem (Try-in) primele.
  return (data || []).sort((a, b) => (b.sistem ? 1 : 0) - (a.sistem ? 1 : 0))
}

// Fără prețuri — pentru formularele de comandă (patron și coordonator).
async function getExtraUriNume() {
  const { data, error } = await supabase.from('extra_uri_nume').select('*').order('created_at')
  fail(error, 'Nu s-au putut încărca extra-urile')
  return (data || []).sort((a, b) => (b.sistem ? 1 : 0) - (a.sistem ? 1 : 0))
}

function numarSauZero(v) {
  return v === '' || v == null ? 0 : Number(v) || 0
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
  const { data, error } = await supabase
    .from('lucrari')
    .insert({ ...built, extra_uri: selectieExtra(input.extra_uri) })
    .select('id, nr_inregistrare')
    .single()
  fail(error, 'Nu s-a putut înregistra lucrarea')
  return data
}

// `patch.extra_uri`, dacă e prezent, e selecția [{ extra_id, cantitate }].
// Coloanele financiare sunt ignorate — le recalculează baza de date când se
// schimbă tipul, nr. elementelor, dinții, Try-in-ul sau extra-urile.
async function updateLucrare(id, patch) {
  let payload = golAsNull(patch, ['data_intrare', 'termen_predare', 'ora_programare', 'next_date'])
  for (const camp of Object.keys(payload)) {
    if (COLOANE_NEPERMISE.has(camp)) delete payload[camp]
  }
  if (payload.dinti !== undefined) payload = { ...payload, dinti: normalizeDinti(payload.dinti) }
  if (payload.extra_uri !== undefined) payload = { ...payload, extra_uri: selectieExtra(payload.extra_uri) }
  const { data, error } = await supabase.from('lucrari').update(payload).eq('id', id).select('id')
  fail(error, `Nu s-a putut actualiza lucrarea ${id}`)
  if (!data?.length) throw new Error('Lucrarea nu a fost găsită sau nu ai dreptul să o modifici.')
}

// `on delete cascade` în schema.sql curăță automat productie_lucrare,
// poze_lucrare și linkuri_lucrare pentru această lucrare.
async function deleteLucrare(id) {
  const { data, error } = await supabase.from('lucrari').delete().eq('id', id).select('id')
  fail(error, `Nu s-a putut șterge lucrarea ${id}`)
  if (!data?.length) throw new Error('Lucrarea nu a fost găsită sau nu ai dreptul să o ștergi.')
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
      // Valorile financiare (și Try-in-ul ca extra) le completează baza de date.
      deInserat.push({ ...built, extra_uri: [] })
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

// Recalculează instantaneul financiar al UNEI lucrări cu prețurile curente din
// Setup (butonul din fișă) — doar patronul; calculul se face în baza de date.
// Devizele deja generate nu se modifică.
async function recalculeazaLucrare(id) {
  const { error } = await supabase.rpc('recalculeaza_lucrare', { p_id: id })
  fail(error, 'Recalcularea a eșuat')
}

// La fel, pentru TOATE lucrările (butonul din Setup → Tipuri de lucrare).
// Lucrările cu un tip care nu mai există în Setup sunt sărite.
async function recalculeazaValoriFinanciare() {
  const { data, error } = await supabase.rpc('recalculeaza_toate_lucrarile')
  fail(error, 'Recalcularea a eșuat')
  return { actualizate: data?.actualizate || 0, sarite: data?.sarite || [] }
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
    // View fără prețuri — merge și pentru coordonator.
    const { data, error } = await supabase.from('tipuri_lucrare_nume').select('nume').order('created_at')
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

async function updateTipLucrareCosturi(id, { cost_laborator, incasare, pret_implant, all_on }) {
  const payload = {
    ...(all_on === undefined ? {} : { all_on: !!all_on }),
    cost_laborator: cost_laborator === '' || cost_laborator == null ? 0 : Number(cost_laborator),
    incasare: incasare === '' || incasare == null ? 0 : Number(incasare),
    pret_implant: pret_implant === '' || pret_implant == null ? 0 : Number(pret_implant),
  }
  const { data, error } = await supabase.from('tipuri_lucrare').update(payload).eq('id', id).select().single()
  fail(error, `Nu s-au putut actualiza costurile tipului de lucrare ${id}`)
  return data
}

async function getSetariSalarii() {
  const { data, error } = await supabase.from('setari_salarii').select('*').eq('id', 1).maybeSingle()
  fail(error, 'Nu s-au putut încărca adaosurile Design')
  return {
    adaos_implant: Number(data?.adaos_implant) || 0,
    adaos_thimble: Number(data?.adaos_thimble) || 0,
    adaos_model_printat: Number(data?.adaos_model_printat) || 0,
  }
}

async function updateSetariSalarii({ adaos_implant, adaos_thimble, adaos_model_printat }) {
  const row = {
    id: 1,
    adaos_implant: Math.max(0, numarSauZero(adaos_implant)),
    adaos_thimble: Math.max(0, numarSauZero(adaos_thimble)),
    adaos_model_printat: Math.max(0, numarSauZero(adaos_model_printat)),
  }
  const { error } = await supabase.from('setari_salarii').upsert(row, { onConflict: 'id' })
  fail(error, 'Nu s-au putut salva adaosurile Design')
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

// Doar bifa „Finalizat" pe un rând existent (UPDATE, nu upsert) — singura
// scriere pe producție permisă unui tehnician, și doar pe rândurile lui.
async function setFinalizareEtapa(lucrareId, etapaId, finalizat) {
  const { data, error } = await supabase
    .from('productie_lucrare')
    .update({ finalizat, data_finalizare: finalizat ? todayISO() : null })
    .eq('lucrare_id', lucrareId)
    .eq('etapa_id', etapaId)
    .select()
    .single()
  fail(error, 'Nu s-a putut salva bifa Finalizat')
  return data
}

// Comisioanele tehnicianului logat pentru luna 'AAAA-LL' — calculate în baza
// de date (RPC `salariul_meu`), fără acces la datele altor tehnicieni.
async function getSalariulMeu(luna) {
  const { data, error } = await supabase.rpc('salariul_meu', { p_luna: luna })
  fail(error, 'Nu s-a putut încărca salariul')
  return data || []
}

// Id-urile tehnicienilor care au deja cont (rând în `profiles`) — vizibil
// doar pentru admin (politica „admin_citire").
async function getTehnicieniCuCont() {
  const { data, error } = await supabase.from('profiles').select('tehnician_id').not('tehnician_id', 'is', null)
  fail(error, 'Nu s-au putut încărca conturile tehnicienilor')
  return new Set((data || []).map((p) => p.tehnician_id))
}

// Apel către o funcție de server (Worker, /api/...) cu sesiunea curentă —
// serverul verifică rolul și folosește cheia de serviciu.
async function apelServer(ruta, corp) {
  const { data: sesiune } = await supabase.auth.getSession()
  const token = sesiune.session?.access_token
  if (!token) throw new Error('Sesiunea a expirat — autentifică-te din nou.')
  let raspuns
  try {
    raspuns = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(corp),
    })
  } catch {
    throw new Error('Serverul nu a putut fi contactat.')
  }
  const body = await raspuns.json().catch(() => null)
  if (!raspuns.ok || !body) throw new Error(body?.eroare || `Serverul a răspuns cu eroarea ${raspuns.status}.`)
  return body
}

// Creează contul tehnicianului sau îi resetează parola (doar patronul).
async function creeazaContTehnician(tehnicianId, parola) {
  return apelServer('/api/creare-cont-tehnician', { tehnician_id: tehnicianId, parola })
}

// ---------------------------------------------------------------------------
// Medici — date de contact + accesul la pagina medicului
// ---------------------------------------------------------------------------

async function getMedici() {
  const { data, error } = await supabase.from('medici').select('*').order('nume')
  fail(error, 'Nu s-au putut încărca medicii')
  return data || []
}

async function updateMedic(id, patch) {
  const payload = {}
  if ('email' in patch) payload.email = String(patch.email || '').trim().toLowerCase() || null
  if ('telefon' in patch) payload.telefon = String(patch.telefon || '').trim() || null
  const { data, error } = await supabase.from('medici').update(payload).eq('id', id).select().single()
  fail(error, 'Nu s-au putut salva datele medicului')
  return data
}

// medic_id → { activ, cod_acces } pentru medicii care au primit acces.
async function getAccesMedici() {
  const { data, error } = await supabase.from('profiles').select('medic_id, activ, cod_acces').eq('rol', 'medic')
  fail(error, 'Nu s-a putut încărca accesul medicilor')
  return new Map((data || []).filter((p) => p.medic_id).map((p) => [p.medic_id, p]))
}

// actiune: 'trimite' | 'link_nou' | 'dezactiveaza' | 'sterge' (vezi worker/index.js).
async function accesMedic(medicId, actiune) {
  return apelServer('/api/acces-medic', { medic_id: medicId, actiune })
}

// ---------------------------------------------------------------------------
// Note pe comandă — partea laboratorului
// ---------------------------------------------------------------------------

async function getSubiecteNote() {
  const { data, error } = await supabase.from('subiecte_note').select('*').order('ordine').order('nume')
  fail(error, 'Nu s-au putut încărca subiectele notelor')
  return data || []
}

async function addSubiectNota(nume) {
  const valoare = String(nume || '').trim()
  if (!valoare) throw new Error('Subiectul nu poate fi gol')
  const lista = await getSubiecteNote()
  if (lista.some((s) => s.nume.toLowerCase() === valoare.toLowerCase())) throw new Error(`Subiectul „${valoare}” există deja`)
  const ordine = lista.reduce((max, s) => Math.max(max, s.ordine), 0) + 1
  const { data, error } = await supabase.from('subiecte_note').insert({ nume: valoare, ordine }).select().single()
  fail(error, 'Nu s-a putut adăuga subiectul')
  return data
}

async function updateSubiectNota(id, patch) {
  const payload = {}
  if ('activ' in patch) payload.activ = !!patch.activ
  if ('nume' in patch) {
    const valoare = String(patch.nume || '').trim()
    if (!valoare) throw new Error('Subiectul nu poate fi gol')
    payload.nume = valoare
  }
  const { data, error } = await supabase.from('subiecte_note').update(payload).eq('id', id).select().single()
  fail(error, 'Nu s-a putut salva subiectul')
  return data
}

async function getSetariNote() {
  const { data, error } = await supabase.from('setari_note').select('*').eq('id', 1).maybeSingle()
  fail(error, 'Nu s-au putut încărca setările notelor')
  return { zile_dupa_livrare: data?.zile_dupa_livrare ?? 7 }
}

async function updateSetariNote({ zile_dupa_livrare }) {
  const zile = Math.max(0, Math.round(Number(zile_dupa_livrare) || 0))
  const { error } = await supabase.from('setari_note').upsert({ id: 1, zile_dupa_livrare: zile }, { onConflict: 'id' })
  fail(error, 'Nu s-au putut salva setările notelor')
}

async function getNoteComanda(comandaId) {
  const { data, error } = await supabase
    .from('note_comanda')
    .select('*')
    .eq('comanda_id', comandaId)
    .order('created_at', { ascending: true })
  fail(error, 'Nu s-au putut încărca notele')
  return data || []
}

// Autorul, rolul, numele subiectului și data le completează baza de date.
// Cu `raspuns_la` (id-ul notei inițiale), nota e un răspuns în acea discuție:
// subiectul și vizibilitatea le preia baza de date de la nota inițială.
async function addNotaComanda({ comanda_id, subiect_id, text, vizibilitate, raspuns_la = null }) {
  const valoare = String(text || '').trim()
  if (!valoare) throw new Error('Scrie textul notei')
  if (valoare.length > 500) throw new Error('Nota poate avea cel mult 500 de caractere')
  const { data, error } = await supabase
    .from('note_comanda')
    .insert({
      comanda_id,
      subiect_id: raspuns_la ? null : subiect_id,
      subiect: '',
      text: valoare,
      vizibilitate: vizibilitate === 'medic' ? 'medic' : 'intern',
      rol_autor: 'tehnician',
      raspuns_la,
    })
    .select()
    .single()
  if (error?.code === '42501') throw new Error('Nota nu s-a putut adăuga: comanda e închisă pentru note sau nu ai acces la ea.')
  fail(error, 'Nu s-a putut adăuga nota')
  return data
}

async function marcheazaDiscutieRezolvata(notaId, rezolvata) {
  const { error } = await supabase.rpc('marcheaza_discutie_rezolvata', { p_nota: notaId, p_rezolvata: !!rezolvata })
  fail(error, 'Nu s-a putut schimba starea discuției')
}

async function noteDeschise(comandaId) {
  const { data, error } = await supabase.rpc('note_deschise', { p_comanda: comandaId })
  fail(error, 'Nu s-a putut verifica dacă comanda primește note')
  return !!data
}

async function marcheazaNoteCitite(comandaId) {
  const { error } = await supabase.rpc('marcheaza_note_citite', { p_comanda: comandaId })
  fail(error, 'Nu s-au putut marca notele ca citite')
}

// Notele medicilor necitite încă de laborator: [{ comanda_id, subiect, created_at }].
async function getNoteNoiDeLaMedici() {
  const { data, error } = await supabase
    .from('note_comanda')
    .select('comanda_id, subiect, created_at')
    .eq('rol_autor', 'medic')
    .is('citita_de_lab', null)
    .order('created_at', { ascending: false })
  fail(error, 'Nu s-au putut încărca notele noi de la medici')
  return data || []
}

// ---------------------------------------------------------------------------
// Pagina medicului — doar prin funcțiile din baza de date (vezi schema.sql)
// ---------------------------------------------------------------------------

async function getInfoAccesMedic(cod) {
  const { data, error } = await supabase.rpc('info_acces_medic', { p_cod: cod })
  fail(error, 'Linkul nu a putut fi verificat')
  return data?.[0] || null
}

async function getComenzileMeleMedic() {
  const { data, error } = await supabase.rpc('comenzile_mele_medic')
  fail(error, 'Nu s-au putut încărca comenzile')
  return data || []
}

// Fișa comenzii pentru medic: fără prețuri, etape, tehnicieni, nota internă.
async function getFisaComandaMedic(nr) {
  const { data, error } = await supabase.rpc('fisa_comanda_medic', { p_nr: nr })
  fail(error, 'Nu s-a putut încărca comanda')
  return data?.[0] || null
}

// -> { poze, linkuri }, doar de citit.
async function getGalerieComandaMedic(comandaId) {
  const { data, error } = await supabase.rpc('galerie_comanda_medic', { p_comanda: comandaId })
  fail(error, 'Nu s-a putut încărca galeria')
  return { poze: data?.poze || [], linkuri: data?.linkuri || [] }
}

async function getNoteleComenziiMedic(comandaId) {
  const { data, error } = await supabase.rpc('notele_comenzii_medic', { p_comanda: comandaId })
  fail(error, 'Nu s-au putut încărca notele')
  return data || []
}

// Cu `raspunsLa`, mesajul e un răspuns în discuția respectivă.
async function addNotaMedic(comandaId, subiectId, text, raspunsLa = null) {
  const valoare = String(text || '').trim()
  if (!valoare) throw new Error('Scrie textul mesajului')
  if (valoare.length > 500) throw new Error('Mesajul poate avea cel mult 500 de caractere')
  const { error } = await supabase.rpc('adauga_nota_medic', {
    p_comanda: comandaId,
    p_subiect: raspunsLa ? null : subiectId,
    p_text: valoare,
    p_raspuns_la: raspunsLa,
  })
  fail(error, 'Răspunsul nu s-a putut trimite')
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

// Rândurile devizului, fiecare cu lucrarea asociată (`lucrare`) —
// suficient pentru previzualizare.
async function getDevizLucrari(devizId) {
  const { data, error } = await supabase.from('deviz_lucrari').select('*').eq('deviz_id', devizId)
  fail(error, 'Nu s-au putut încărca lucrările devizului')
  const randuri = data || []
  if (randuri.length === 0) return []
  // Lucrarea vine din `lucrari_vizibile` — coloanele financiare nu se pot
  // citi direct din `lucrari`.
  const { data: lucrari, error: e2 } = await supabase
    .from('lucrari_vizibile')
    .select('*')
    .in('id', randuri.map((r) => r.lucrare_id))
  fail(e2, 'Nu s-au putut încărca lucrările devizului')
  const byId = new Map((lucrari || []).map((l) => [l.id, l]))
  return randuri.map((r) => ({ ...r, lucrare: byId.get(r.lucrare_id) || null }))
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

  const lucrariArhivate = await arhiveazaLucrarileFinalizate(lucrari.map((l) => l.id))
  return { ...deviz, lucrariArhivate }
}

// Arhivare automată la generarea devizului — doar lucrările FINALIZATE (toate
// etapele din Setup bifate, același criteriu ca statusul „Finalizat" și ca
// butonul manual de arhivare). Cele neterminate rămân active, ca producția
// să poată continua; cele deja arhivate nu se ating (își păstrează data).
async function arhiveazaLucrarileFinalizate(lucrareIds) {
  const [{ data: etape, error: e1 }, { data: randuri, error: e2 }] = await Promise.all([
    supabase.from('etape_productie').select('id'),
    supabase.from('productie_lucrare').select('lucrare_id, finalizat').in('lucrare_id', lucrareIds),
  ])
  fail(e1 || e2, 'Devizul a fost creat, dar starea lucrărilor nu s-a putut verifica pentru arhivare')
  const totalEtape = (etape || []).length
  if (totalEtape === 0) return 0
  const finalizate = lucrareIds.filter(
    (id) => (randuri || []).filter((r) => r.lucrare_id === id && r.finalizat).length >= totalEtape
  )
  if (finalizate.length === 0) return 0
  const { data, error } = await supabase
    .from('lucrari')
    .update({ arhivat: true, data_arhivare: new Date().toISOString() })
    .in('id', finalizate)
    .eq('arhivat', false)
    .select('id')
  fail(error, 'Devizul a fost creat, dar lucrările finalizate nu s-au putut arhiva')
  return (data || []).length
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
  deleteLucrare,
  numaraLucrariSiDevize,
  stergeToateLucrarile,
  getExtraUri,
  getExtraUriNume,
  addExtra,
  updateExtra,
  getConfigList,
  addConfigValue,
  generateNrInregistrare,
  importLucrari,
  recalculeazaValoriFinanciare,
  recalculeazaLucrare,
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
  getSetariSalarii,
  updateSetariSalarii,
  addTipLucrare,
  renameTipLucrare,
  deleteTipLucrare,
  getComisioane,
  setComisiune,
  getProductieLucrare,
  getProductieTehnician,
  getToateAlocarile,
  setProductieAlocare,
  setFinalizareEtapa,
  getSalariulMeu,
  getTehnicieniCuCont,
  creeazaContTehnician,
  getMedici,
  updateMedic,
  getAccesMedici,
  accesMedic,
  getSubiecteNote,
  addSubiectNota,
  updateSubiectNota,
  getSetariNote,
  updateSetariNote,
  getNoteComanda,
  addNotaComanda,
  noteDeschise,
  marcheazaNoteCitite,
  marcheazaDiscutieRezolvata,
  getNoteNoiDeLaMedici,
  getInfoAccesMedic,
  getComenzileMeleMedic,
  getFisaComandaMedic,
  getGalerieComandaMedic,
  getNoteleComenziiMedic,
  addNotaMedic,
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
