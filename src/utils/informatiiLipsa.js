// Lucrări cu informații lipsă — notificările din clopoțelul din header și
// marcajul roșu „Lipsește" din fișa lucrării. Funcții pure, testate în
// informatiiLipsa.test.js; calculul vine doar din datele lucrării.

import { statusLucrare } from './statusLucrare.js'

// Câmpurile obligatorii — UN SINGUR LOC: adaugi sau scoți un rând și clopoțelul,
// panoul și fișa se schimbă împreună. `cheie` = coloana din `lucrari`;
// `eticheta` = cum apare în notificare („lipsește: …").
//
// Lipsește „culoare" (la fel ca „model", „implant", „try_in") intenționat: culoarea
// se alege doar la lucrările vizibile (nu la Wax-UP, Gutieră, All-on-X etc.) și în
// datele reale e goală la ~9 din 10 lucrări, deci ar semnala aproape tot registrul.
// Ca s-o urmărești, adaugă: { cheie: 'culoare', eticheta: 'culoare' }.
export const CAMPURI_OBLIGATORII = [
  { cheie: 'clinica', eticheta: 'clinica' },
  { cheie: 'medic', eticheta: 'medic' },
  { cheie: 'pacient', eticheta: 'pacient' },
  { cheie: 'tip_lucrare', eticheta: 'tip de lucrare' },
  { cheie: 'termen_predare', eticheta: 'termen de predare' },
  { cheie: 'dinti', eticheta: 'dinți' },
]

// Gol = null/undefined, text doar din spații sau listă fără elemente.
export function esteGol(valoare) {
  if (valoare == null) return true
  if (typeof valoare === 'string') return valoare.trim() === ''
  if (Array.isArray(valoare)) return valoare.length === 0
  return false
}

// Câmpurile obligatorii goale ale lucrării (sau ale unui obiect cu aceleași chei,
// ex. valorile curente din fișă) — [{ cheie, eticheta }] în ordinea din listă.
export function campuriLipsa(valori) {
  return CAMPURI_OBLIGATORII.filter(({ cheie }) => esteGol(valori?.[cheie]))
}

// O lucrare e finalizată când toate etapele din Setup sunt bifate (aceeași regulă
// ca în căutarea globală, Listă și Kanban).
export function esteFinalizata(etape, randuriProductie) {
  return statusLucrare(etape, randuriProductie).id === 'finalizat'
}

// Lucrările nefinalizate (și nearhivate) cu cel puțin un câmp obligatoriu gol,
// cele mai recente primele: [{ lucrare, lipsa: [{ cheie, eticheta }] }].
// Lucrările vechi, deja finalizate, nu intră — ca să nu inunde notificările.
export function lucrariCuLipsuri({ lucrari, etape, alocari }) {
  const randuriPeLucrare = new Map()
  for (const r of alocari) {
    if (!randuriPeLucrare.has(r.lucrare_id)) randuriPeLucrare.set(r.lucrare_id, [])
    randuriPeLucrare.get(r.lucrare_id).push(r)
  }
  const rezultat = []
  for (const lucrare of lucrari) {
    if (lucrare.arhivat) continue
    if (esteFinalizata(etape, randuriPeLucrare.get(lucrare.id) || [])) continue
    const lipsa = campuriLipsa(lucrare)
    if (lipsa.length > 0) rezultat.push({ lucrare, lipsa })
  }
  rezultat.sort((a, b) => {
    const da = a.lucrare.created_at || ''
    const db = b.lucrare.created_at || ''
    if (da !== db) return da < db ? 1 : -1
    return (b.lucrare.nr_inregistrare || '').localeCompare(a.lucrare.nr_inregistrare || '', 'ro', { numeric: true })
  })
  return rezultat
}

// „AA-123 · Popescu — lipsește: culoare, termen de predare"
export function textNotificare({ lucrare, lipsa }) {
  const pacient = (lucrare.pacient || '').trim()
  return `${lucrare.nr_inregistrare}${pacient ? ` · ${pacient}` : ''} — lipsește: ${lipsa.map((c) => c.eticheta).join(', ')}`
}
