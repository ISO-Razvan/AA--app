// Notele unei comenzi grupate pe discuții: nota inițială (`raspuns_la` gol) +
// răspunsurile ei, în ordine cronologică. Discuțiile deschise vin primele,
// apoi cele cu activitatea cea mai recentă.
// `esteRezolvata(nota)` diferă între laborator (rezolvata_la) și medic (rezolvata).
export function grupeazaDiscutii(note, esteRezolvata = (n) => !!n.rezolvata_la) {
  const raspunsuri = new Map()
  for (const n of note) {
    if (!n.raspuns_la) continue
    if (!raspunsuri.has(n.raspuns_la)) raspunsuri.set(n.raspuns_la, [])
    raspunsuri.get(n.raspuns_la).push(n)
  }
  return note
    .filter((n) => !n.raspuns_la)
    .map((nota) => {
      const lista = (raspunsuri.get(nota.id) || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
      const ultima = lista.length > 0 ? lista[lista.length - 1].created_at : nota.created_at
      return { nota, raspunsuri: lista, ultima, rezolvata: esteRezolvata(nota) }
    })
    .sort((a, b) => Number(a.rezolvata) - Number(b.rezolvata) || b.ultima.localeCompare(a.ultima))
}
