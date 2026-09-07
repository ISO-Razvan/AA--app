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
