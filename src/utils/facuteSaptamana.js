// „Făcute în săptămâna asta": ce a finalizat un tehnician într-o săptămână, pe zile.
// O lucrare apare în ziua DATEI DE FINALIZARE (data_finalizare), nu a celei planificate,
// și doar pentru tehnicianul ales (tehnician_id). Funcții pure, testate în
// facuteSaptamana.test.js.

import { adaugaZile } from './date.js'

// Cele 7 zile (luni–duminică) ale săptămânii aflate la `offset` săptămâni de ziua `astazi`.
export function zileSaptamanii(astazi, offset = 0) {
  const ziSapt = new Date(`${astazi}T00:00:00`).getDay() // 0 = duminică
  const luni = adaugaZile(astazi, (ziSapt === 0 ? -6 : 1 - ziSapt) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => adaugaZile(luni, i))
}

// -> { [zi]: [{ alocare, lucrare, etapa }] } pentru fiecare zi din `zile`; în zi, după nr. comenzii.
// `lucrari` trebuie să conțină și lucrările arhivate (cele finalizate se arhivează la deviz).
export function facutePeZi({ alocari, lucrari, etape, tehnicianId, zile }) {
  const lucrarePeId = new Map(lucrari.map((l) => [l.id, l]))
  const etapaPeId = new Map(etape.map((e) => [e.id, e]))
  const rezultat = Object.fromEntries(zile.map((zi) => [zi, []]))
  for (const alocare of alocari) {
    if (alocare.tehnician_id !== tehnicianId || !alocare.finalizat || !alocare.data_finalizare) continue
    const lista = rezultat[alocare.data_finalizare]
    const lucrare = lucrarePeId.get(alocare.lucrare_id)
    if (!lista || !lucrare) continue
    lista.push({ alocare, lucrare, etapa: etapaPeId.get(alocare.etapa_id) || null })
  }
  for (const lista of Object.values(rezultat)) {
    lista.sort((x, y) => (x.lucrare.nr_inregistrare || '').localeCompare(y.lucrare.nr_inregistrare || '', 'ro', { numeric: true }))
  }
  return rezultat
}

// „—" pentru zero; „1 lucrare" / „N lucrări".
export function textTotal(n) {
  if (n === 0) return '—'
  return `${n} ${n === 1 ? 'lucrare' : 'lucrări'}`
}
