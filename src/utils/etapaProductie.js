// Etapa „Livrare" e planificată automat din termenul de predare (trigger în
// baza de date, vezi schema.sql) — doar dacă există exact un tehnician cu
// rolul Livrare. Altfel se comportă ca orice altă etapă (alocare manuală).
export function configLivrare(etape, tehnicieni) {
  const etapa = etape.find((e) => (e.nume || '').trim().toLowerCase() === 'livrare') || null
  const cuRol = etapa ? tehnicieni.filter((t) => (t.roluri || []).includes(etapa.id)) : []
  return { etapa, tehnicieniCuRol: cuRol, automata: !!etapa && cuRol.length === 1 }
}

// Etapa „Validare" a designerului: identificată prin codul stabil `cod = 'validare'`
// din baza de date (setat din Setup → Etape de producție), NU prin nume — numele
// se poate redenumi. Fără etapă marcată, funcția de validare nu există în aplicație.
export const esteEtapaValidare = (etapa) => etapa?.cod === 'validare'

// Design se recunoaște după nume (ca în adaosurile Design și în triggerul din baza de
// date); numele lui nu se poate redenumi (vezi motivBlocareRedenumire).
export const esteEtapaDesignNume = (etapa) => String(etapa?.nume || '').trim().toLowerCase() === 'design'

// Lucrarea e „trimisă la validare" când rândul ei de Design are marcajul și nu e finalizat.
export function esteTrimisaLaValidare(etape, randuriLucrare) {
  const design = etape.find(esteEtapaDesignNume)
  const rand = design ? randuriLucrare.find((r) => r.etapa_id === design.id) : null
  return !!(rand?.trimis_la_validare_la && !rand.finalizat)
}

// Etapele care se aplică unei lucrări. Validare se aplică doar dacă lucrarea are rând
// pentru ea (finalizat automat când s-a finalizat Designul) sau e trimisă acum la
// validare. Așa, o etapă Validare adăugată ulterior în Setup NU strică lucrările
// existente (nu apar „nefinalizate la Validare" și nu-și schimbă statusul).
export function etapeAplicabile(etape, randuriLucrare) {
  const validare = etape.find(esteEtapaValidare)
  if (!validare) return etape
  const areRand = randuriLucrare.some((r) => r.etapa_id === validare.id)
  if (areRand || esteTrimisaLaValidare(etape, randuriLucrare)) return etape
  return etape.filter((e) => e.id !== validare.id)
}

// Determină etapa curentă a unei lucrări dintr-un flux de producție —
// prima etapă (în ordinea din Setup → Etape de producție) care nu are încă
// un rând `finalizat` în `productie_lucrare`. Dacă toate etapele sunt
// finalizate (sau nu există etape), returnează `etapa: null`, convenția
// folosită de Kanban/Dashboard/Task-uri pentru „Finalizat”.
// Excepție: dacă rândul de Design are `trimis_la_validare_la` și nu e finalizat,
// etapa curentă e Validare. Kanban, Dashboard și Task-uri o folosesc pe aceasta.
export function etapaCurentaPentru(etape, randuriLucrare) {
  const aplicabile = etapeAplicabile(etape, randuriLucrare)
  for (const etapa of aplicabile) {
    const rand = randuriLucrare.find((r) => r.etapa_id === etapa.id)
    if (!rand || !rand.finalizat) {
      if (esteEtapaDesignNume(etapa) && rand?.trimis_la_validare_la) {
        const validare = aplicabile.find(esteEtapaValidare)
        if (validare) return { etapa: validare, rand: randuriLucrare.find((r) => r.etapa_id === validare.id) || null }
      }
      return { etapa, rand: rand || null }
    }
  }
  return { etapa: null, rand: null }
}

// Etape pe care codul și baza de date le recunosc DUPĂ NUME (nu după id), deci
// nu se pot redenumi: o redenumire le-ar scoate din funcția lor fără nicio eroare.
//  - Model: se bifează fără tehnician, are comportament propriu în producție;
//  - Design: la ea se adaugă adaosurile Design la salariu;
//  - Livrare: se planifică automat din termenul de predare (trigger în baza de
//    date) și e folosită de obiectivul „Livrări la termen".
// Ca să poată fi redenumite, ar trebui o coloană stabilă de identificare în
// baza de date (vezi propunerea din discuție) — până atunci rămân blocate.
const ETAPE_DE_SISTEM = {
  model: 'se bifează fără tehnician și are comportament propriu în producție',
  design: 'la ea se adaugă adaosurile Design la salariu',
  livrare: 'se planifică automat din termenul de predare și e folosită de obiectivul „Livrări la termen"',
}

// Motivul pentru care etapa nu se poate redenumi, sau null dacă se poate.
export function motivBlocareRedenumire(numeEtapa) {
  const cheie = String(numeEtapa || '').trim().toLowerCase()
  return ETAPE_DE_SISTEM[cheie] || null
}

// Etapa „Model" (se bifează fără tehnician, nu se programează). Singura referință
// din aplicație: toate locurile apelează funcția asta, nu compară numele. Numele
// „Model" nu se poate redenumi (vezi motivBlocareRedenumire), deci referința e
// stabilă; o coloană de identificare în baza de date ar înlocui doar corpul ei.
export const esteEtapaModel = (etapa) => String(etapa?.nume || '').trim().toLowerCase() === 'model'
