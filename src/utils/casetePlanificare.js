// Casetele „Lucrări neprogramate" din Task-uri: urgența, filtrele rapide și
// actualizarea locală a alocărilor după o programare. Funcții pure, testate în
// casetePlanificare.test.js (`node --test src/utils/casetePlanificare.test.js`).
import { zileDepasite } from './etapeNeplanificate.js'

// Urgența unei casete după termenul de predare:
//  - termen depășit sau azi → 'rosu';
//  - mâine sau poimâine (1–2 zile) → 'portocaliu';
//  - mai departe sau fără termen → 'neutru'.
// `eticheta` e textul care însoțește mereu culoarea (nu doar culoare).
export function urgentaCaseta(termen, astazi) {
  if (!termen) return { nivel: 'neutru', eticheta: 'Fără termen' }
  if (termen < astazi) return { nivel: 'rosu', eticheta: 'Depășit' }
  const zile = zileDepasite(astazi, termen)
  if (zile === 0) return { nivel: 'rosu', eticheta: 'Azi' }
  if (zile === 1) return { nivel: 'portocaliu', eticheta: 'Mâine' }
  if (zile === 2) return { nivel: 'portocaliu', eticheta: 'În 2 zile' }
  return { nivel: 'neutru', eticheta: '' }
}

export const esteUrgenta = (termen, astazi) => urgentaCaseta(termen, astazi).nivel !== 'neutru'

// Etapele din casete, fără dubluri, în ordinea din Setup — pentru filtrul pe etapă.
// `casete` = [{ lucrare, etape: [{ id, nume }] }] (cum le dă etapeNeplanificateTehnician).
export function etapeDinCasete(casete, etape) {
  const prezente = new Set(casete.flatMap((c) => c.etape.map((e) => e.id)))
  return etape.filter((e) => prezente.has(e.id))
}

// Filtrele rapide: o etapă anume și/sau doar urgentele. Păstrează ordinea.
export function filtreazaCasete({ casete, etapaId, doarUrgente, astazi }) {
  return casete.filter((c) => {
    if (etapaId && !c.etape.some((e) => e.id === etapaId)) return false
    if (doarUrgente && !esteUrgenta(c.lucrare.termen_predare, astazi)) return false
    return true
  })
}

// Alocările după ce `patch` a fost aplicat pe etapele date ale lucrării — folosit
// pentru actualizarea imediată a ecranului (înainte de răspunsul bazei de date).
// Rândurile care nu există încă se adaugă; celelalte câmpuri se păstrează.
export function aplicaPatchAlocari(alocari, lucrareId, etapaIds, patch) {
  const rezultat = alocari.map((a) => (a.lucrare_id === lucrareId && etapaIds.includes(a.etapa_id) ? { ...a, ...patch } : a))
  for (const etapaId of etapaIds) {
    if (!alocari.some((a) => a.lucrare_id === lucrareId && a.etapa_id === etapaId)) {
      rezultat.push({ lucrare_id: lucrareId, etapa_id: etapaId, finalizat: false, ...patch })
    }
  }
  return rezultat
}
