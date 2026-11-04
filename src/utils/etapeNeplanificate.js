// Etapele „neplanificate" din Task-uri, împărțite în două:
//  - listele normale, pe tehnician (etape de planificat);
//  - lucrările restante: termenul de predare a trecut, dar au etape neplanificate
//    și nebifate — se închid retroactiv, nu se mai planifică.
//
// Regula de laborator: o lucrare care a depășit termenul de predare (măcar cu o
// zi) a fost deja trimisă în clinică, deci etapele ei nebifate sunt de fapt
// făcute și trebuie doar închise, cu data reală. Vechimea după data intrării
// NU contează (o lucrare poate dura 30–40 de zile din motive obiective).
//
// Funcții pure, fără React și fără acces la baza de date — testate în
// etapeNeplanificate.test.js (`node --test src/utils`).

import { esteEtapaModel, esteEtapaValidare, etapaCurentaPentru } from './etapaProductie.js'
import { esteEtapaDesign } from './adaosuriDesign.js'

// Re-exportat: RestanteModal și testele îl importă de aici.
export { esteEtapaModel }

const NUME_LUNI = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]

// O etapă e „alocată" când are tehnician ȘI dată planificată.
export const esteAlocata = (rand) => !!(rand?.tehnician_id && rand?.data_planificata)

// Termen depășit = mai vechi decât azi (termenul de azi încă nu e depășit).
export const termenDepasit = (termen, astazi) => !!termen && termen < astazi

// Zilele de la termen până azi (ambele 'AAAA-LL-ZZ').
export function zileDepasite(termen, astazi) {
  const [a1, l1, z1] = termen.split('-').map(Number)
  const [a2, l2, z2] = astazi.split('-').map(Number)
  return Math.round((Date.UTC(a2, l2 - 1, z2) - Date.UTC(a1, l1 - 1, z1)) / 86400000)
}

// „octombrie 2026" — luna salariului în care intră o etapă bifată la data dată.
export function lunaSalariu(data) {
  const [a, l] = data.split('-').map(Number)
  return `${NUME_LUNI[l - 1]} ${a}`
}

// O etapă „nu e programată" când nu are tehnician + dată. Livrarea automată
// (planificată din termen de trigger) nu contează ca neprogramată dacă lucrarea
// are termen.
function esteNeprogramata(lucrare, etapaId, rand, livrareAutoId) {
  if (etapaId === livrareAutoId && lucrare.termen_predare) return false
  return !esteAlocata(rand)
}

// Etapa în care lucrarea așteaptă programare ACUM (sau null): etapa ei curentă din
// Kanban — prima etapă nefinalizată, în ordinea din Setup (etapaCurentaPentru) — dacă
// rândul ei nu are încă dată planificată. Excepția „Model": lucrarea nouă stă în
// coloana Model, dar se programează la DESIGN (Model se bifează automat când se
// programează designul). Livrarea cu termen se planifică singură, deci nu apare.
export function etapaDeProgramat({ lucrare, etape, randuriLucrare, livrareAutoId }) {
  const { etapa: curenta } = etapaCurentaPentru(etape, randuriLucrare)
  if (!curenta) return null
  // Validare (lucrare trimisă de designer) nu se programează: așteaptă validarea.
  if (esteEtapaValidare(curenta)) return null
  let tinta = curenta
  if (esteEtapaModel(curenta)) {
    tinta = etape.find(esteEtapaDesign) || etape[etape.findIndex((e) => e.id === curenta.id) + 1] || null
  }
  if (!tinta) return null
  const rand = randuriLucrare.find((r) => r.etapa_id === tinta.id)
  if (rand?.finalizat || rand?.data_planificata) return null
  if (tinta.id === livrareAutoId && lucrare.termen_predare) return null
  return tinta
}

// Lucrările de programat, pe etapă: Map(etapa_id -> [{ lucrare, etapa }]), cele mai
// urgente primele (fără termen, la coadă). O lucrare apare la O SINGURĂ etapă — cea
// curentă — nu la toate etapele tehnicianului. Nu intră lucrările restante (termen
// depășit): merg în alerta „lucrări restante". Un tehnician vede doar etapele din
// rolurile lui (`tehnicieni.roluri`).
export function neprogramatePeEtapa({ lucrari, etape, alocari, livrareAutoId, astazi }) {
  const randuriPeLucrare = new Map()
  for (const r of alocari) {
    if (!randuriPeLucrare.has(r.lucrare_id)) randuriPeLucrare.set(r.lucrare_id, [])
    randuriPeLucrare.get(r.lucrare_id).push(r)
  }
  const rezultat = new Map()
  for (const lucrare of lucrari) {
    if (termenDepasit(lucrare.termen_predare, astazi)) continue
    const etapa = etapaDeProgramat({ lucrare, etape, randuriLucrare: randuriPeLucrare.get(lucrare.id) || [], livrareAutoId })
    if (!etapa) continue
    if (!rezultat.has(etapa.id)) rezultat.set(etapa.id, [])
    rezultat.get(etapa.id).push({ lucrare, etapa })
  }
  for (const lista of rezultat.values()) {
    // Fără termen, la coada listei; sortarea e stabilă.
    lista.sort((x, y) => {
      const tx = x.lucrare.termen_predare
      const ty = y.lucrare.termen_predare
      if (tx === ty) return 0
      if (!tx) return 1
      if (!ty) return -1
      return tx < ty ? -1 : 1
    })
  }
  return rezultat
}

// Etapele (în ordinea din Setup) la care așteaptă lucrări, dar pe care nu le are
// niciun tehnician în roluri — lucrări blocate pe nesimțite. Model nu intră: nu se
// programează. [{ etapa, nr }]
export function etapeFaraTehnician({ etape, tehnicieni, programatePeEtapa }) {
  return etape
    .filter((e) => !esteEtapaModel(e) && !esteEtapaValidare(e))
    .filter((e) => !tehnicieni.some((t) => (t.roluri || []).includes(e.id)))
    .map((e) => ({ etapa: e, nr: programatePeEtapa.get(e.id)?.length || 0 }))
    .filter((x) => x.nr > 0)
}

// Lucrările restante: termen_predare < azi și cel puțin o etapă neprogramată și
// nebifată, cele mai întârziate primele:
// [{ lucrare, zile, etape: [{ etapa, rand }] }]
// `etape` = TOATE etapele nebifate ale lucrării (și cele deja programate), în
// ordinea din Setup: o lucrare restantă se închide întreagă, fără închideri parțiale.
export function lucrariRestante({ lucrari, etape, alocari, livrareAutoId, astazi }) {
  const rezultat = []
  for (const l of lucrari) {
    if (!termenDepasit(l.termen_predare, astazi)) continue
    const nebifate = []
    let areNeprogramata = false
    // Validare nu se închide retroactiv: nu are tehnician și se aplică doar când designul
    // trece prin validare.
    for (const etapa of etape.filter((e) => !esteEtapaValidare(e))) {
      const rand = alocari.find((a) => a.lucrare_id === l.id && a.etapa_id === etapa.id) || null
      if (rand?.finalizat) continue
      nebifate.push({ etapa, rand })
      if (esteNeprogramata(l, etapa.id, rand, livrareAutoId)) areNeprogramata = true
    }
    if (areNeprogramata) rezultat.push({ lucrare: l, zile: zileDepasite(l.termen_predare, astazi), etape: nebifate })
  }
  rezultat.sort((a, b) => (a.lucrare.termen_predare < b.lucrare.termen_predare ? -1 : a.lucrare.termen_predare > b.lucrare.termen_predare ? 1 : 0))
  return rezultat
}

// Cine poate fi trecut pe etapă: tehnicienii cu rolul ei; dacă niciunul nu are
// rolul (ex. Frezare), toți. Cel deja trecut pe etapă rămâne în listă.
export function candidatiEtapa(etapa, rand, tehnicieni) {
  const detinatori = tehnicieni.filter((t) => (t.roluri || []).includes(etapa.id))
  const lista = detinatori.length > 0 ? [...detinatori] : [...tehnicieni]
  if (rand?.tehnician_id && !lista.some((t) => t.id === rand.tehnician_id)) {
    const existent = tehnicieni.find((t) => t.id === rand.tehnician_id)
    if (existent) lista.push(existent)
  }
  return lista
}

// Tehnicianul presetat pe etapă: cel deja alocat; altfel singurul cu rolul etapei.
// Model nu are tehnician.
export function tehnicianPresetat(etapa, rand, tehnicieni) {
  if (esteEtapaModel(etapa)) return ''
  const lista = candidatiEtapa(etapa, rand, tehnicieni)
  if (rand?.tehnician_id && lista.some((t) => t.id === rand.tehnician_id)) return rand.tehnician_id
  const detinatori = tehnicieni.filter((t) => (t.roluri || []).includes(etapa.id))
  return detinatori.length === 1 ? detinatori[0].id : ''
}

// Ce lipsește pentru a putea închide lucrarea — [] = poate continua.
// `tehnicianPe` = { [etapa_id]: tehnician_id }.
export function problemeInchidere({ intrare, tehnicianPe }) {
  const probleme = []
  for (const { etapa } of intrare.etape) {
    if (esteEtapaModel(etapa)) continue
    if (!tehnicianPe[etapa.id]) probleme.push(`Alege cine a făcut etapa ${etapa.nume}.`)
  }
  return probleme
}

export function problemeData({ intrare, data, astazi }) {
  if (!data) return ['Alege data.']
  if (data > astazi) return ['Data nu poate fi în viitor.']
  const intrat = intrare.lucrare.data_intrare
  if (intrat && data < intrat) return ['Data e înainte de data intrării lucrării.']
  return []
}

// Rândurile care se scriu în `productie_lucrare` la confirmare: toate etapele
// nebifate ale lucrării. Model: doar bifat; celelalte: tehnician + dată planificată.
export function randuriDeInchis({ intrare, tehnicianPe, data }) {
  return intrare.etape.map(({ etapa }) => ({
    lucrare_id: intrare.lucrare.id,
    etapa_id: etapa.id,
    tehnician_id: esteEtapaModel(etapa) ? null : tehnicianPe[etapa.id] || null,
    data_planificata: esteEtapaModel(etapa) ? null : data,
  }))
}
