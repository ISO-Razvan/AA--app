// Statusul general al unei lucrări, calculat din câte etape de producție
// (din totalul etapelor configurate în Setup → Etape de producție) sunt
// marcate `finalizat` în `productie_lucrare`.

import { etapeAplicabile } from './etapaProductie.js'

export const STATUS_LUCRARE = {
  neinceput: { id: 'neinceput', label: 'Neînceput', badgeClass: 'badge-neutral' },
  in_lucru: { id: 'in_lucru', label: 'În lucru', badgeClass: 'badge-warning' },
  finalizat: { id: 'finalizat', label: 'Finalizat', badgeClass: 'badge-success' },
}

export function calculeazaStatusLucrare(totalEtape, etapeFinalizate) {
  if (totalEtape === 0 || etapeFinalizate === 0) return STATUS_LUCRARE.neinceput
  if (etapeFinalizate >= totalEtape) return STATUS_LUCRARE.finalizat
  return STATUS_LUCRARE.in_lucru
}

export function statusDinRanduri(totalEtape, randuriProductie) {
  const finalizate = randuriProductie.filter((r) => r.finalizat).length
  return calculeazaStatusLucrare(totalEtape, finalizate)
}

// Statusul unei lucrări din etapele ei APLICABILE (Validare doar dacă se aplică
// lucrării) — varianta de folosit peste tot unde se știe lista de etape.
export function statusLucrare(etape, randuriLucrare) {
  const aplicabile = etapeAplicabile(etape, randuriLucrare)
  const finalizate = aplicabile.filter((e) => randuriLucrare.find((r) => r.etapa_id === e.id)?.finalizat).length
  return calculeazaStatusLucrare(aplicabile.length, finalizate)
}
