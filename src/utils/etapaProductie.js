// Etapa „Livrare" e planificată automat din termenul de predare (trigger în
// baza de date, vezi schema.sql) — doar dacă există exact un tehnician cu
// rolul Livrare. Altfel se comportă ca orice altă etapă (alocare manuală).
export function configLivrare(etape, tehnicieni) {
  const etapa = etape.find((e) => (e.nume || '').trim().toLowerCase() === 'livrare') || null
  const cuRol = etapa ? tehnicieni.filter((t) => (t.roluri || []).includes(etapa.id)) : []
  return { etapa, tehnicieniCuRol: cuRol, automata: !!etapa && cuRol.length === 1 }
}

// Determină etapa curentă a unei lucrări dintr-un flux de producție —
// prima etapă (în ordinea din Setup → Etape de producție) care nu are încă
// un rând `finalizat` în `productie_lucrare`. Dacă toate etapele sunt
// finalizate (sau nu există etape), returnează `etapa: null`, convenția
// folosită de Kanban/Dashboard pentru coloana/bucket-ul „Finalizat”.
export function etapaCurentaPentru(etape, randuriLucrare) {
  for (const etapa of etape) {
    const rand = randuriLucrare.find((r) => r.etapa_id === etapa.id)
    if (!rand || !rand.finalizat) return { etapa, rand: rand || null }
  }
  return { etapa: null, rand: null }
}
