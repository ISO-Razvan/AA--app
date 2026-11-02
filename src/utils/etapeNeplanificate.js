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

const NUME_LUNI = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
]

// O etapă e „alocată" când are tehnician ȘI dată planificată.
export const esteAlocata = (rand) => !!(rand?.tehnician_id && rand?.data_planificata)

// Etapa „Model" se bifează fără tehnician (se identifică după nume, ca în fișa lucrării).
export const esteEtapaModel = (etapa) => etapa?.nume === 'Model'

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

// Etapele neplanificate ale tehnicianului (după rolurile lui) — [{ lucrare, etape }],
// cele mai urgente primele. Nu intră:
//  - etapele bifate (sunt făcute, chiar dacă n-au tehnician sau dată);
//  - lucrările restante (au termenul depășit, merg în alertă);
//  - Livrarea automată dacă lucrarea are deja termen (data ei e termenul).
export function etapeNeplanificateTehnician({ lucrari, etape, alocari, tehnician, livrareAutoId, astazi }) {
  if (!tehnician) return []
  const roluri = tehnician.roluri || []
  const rezultat = []
  for (const l of lucrari) {
    if (termenDepasit(l.termen_predare, astazi)) continue
    const etapeNealocate = []
    for (const etapaId of roluri) {
      const rand = alocari.find((a) => a.lucrare_id === l.id && a.etapa_id === etapaId)
      if (rand?.finalizat) continue
      if (!esteNeprogramata(l, etapaId, rand, livrareAutoId)) continue
      const etapa = etape.find((e) => e.id === etapaId)
      if (etapa) etapeNealocate.push(etapa)
    }
    if (etapeNealocate.length > 0) rezultat.push({ lucrare: l, etape: etapeNealocate })
  }
  // Fără termen, la coada listei; sortarea e stabilă.
  rezultat.sort((a, b) => {
    const ta = a.lucrare.termen_predare
    const tb = b.lucrare.termen_predare
    if (ta === tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return ta < tb ? -1 : 1
  })
  return rezultat
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
    for (const etapa of etape) {
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
