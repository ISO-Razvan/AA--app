import { ORDINE_MAXILAR, ORDINE_MANDIBULA } from './fdi'

// Determină grupurile (punți) din perechile legate explicit de utilizator.
// O pereche [a, b] contează doar dacă a și b sunt vecini pe conturul aceleiași
// arcade (garantat de UI, care generează perechile doar din dinți adiacenți).
function grupuriDinArc(order, selectedSet, linkSet) {
  const grupOf = new Map()
  let i = 0
  while (i < order.length) {
    if (!selectedSet.has(order[i])) {
      i++
      continue
    }
    let j = i
    const run = [order[i]]
    while (j + 1 < order.length && selectedSet.has(order[j + 1]) && linkSet.has(`${order[j]}-${order[j + 1]}`)) {
      run.push(order[j + 1])
      j++
    }
    const gid = run.length > 1 ? `g-${run.join('-')}` : null
    for (const n of run) grupOf.set(n, gid)
    i = j + 1
  }
  return grupOf
}

// selectateNumere: number[], linkPairs: [number, number][]
// -> [{ numar, grup }]
export function calculeazaDinti(selectateNumere, linkPairs) {
  const selectedSet = new Set(selectateNumere)
  const linkSet = new Set(linkPairs.map(([a, b]) => `${a}-${b}`))
  const grupMaxilar = grupuriDinArc(ORDINE_MAXILAR, selectedSet, linkSet)
  const grupMandibula = grupuriDinArc(ORDINE_MANDIBULA, selectedSet, linkSet)
  return selectateNumere.map((numar) => ({
    numar,
    grup: grupMaxilar.get(numar) ?? grupMandibula.get(numar) ?? null,
  }))
}

// Reface selecția + perechile legate dintr-un array salvat [{numar, grup}],
// pentru pre-completarea formularului la editare.
export function dinDintiSalvati(dinti) {
  const selectateNumere = (dinti || []).map((d) => d.numar)
  const dintiMap = new Map((dinti || []).map((d) => [d.numar, d.grup ?? null]))
  const linkPairs = []
  for (const order of [ORDINE_MAXILAR, ORDINE_MANDIBULA]) {
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i]
      const b = order[i + 1]
      const ga = dintiMap.get(a)
      const gb = dintiMap.get(b)
      if (ga && gb && ga === gb) linkPairs.push([a, b])
    }
  }
  return { selectateNumere, linkPairs }
}

export function toggleLinkPair(linkPairs, a, b) {
  const exists = linkPairs.some(([x, y]) => x === a && y === b)
  if (exists) return linkPairs.filter(([x, y]) => !(x === a && y === b))
  return [...linkPairs, [a, b]]
}

export function toggleToothSelection(selectateNumere, linkPairs, numar) {
  const isSelected = selectateNumere.includes(numar)
  const nextSelectate = isSelected
    ? selectateNumere.filter((n) => n !== numar)
    : [...selectateNumere, numar].sort((a, b) => a - b)
  const nextLinkPairs = isSelected
    ? linkPairs.filter(([a, b]) => a !== numar && b !== numar)
    : linkPairs
  return { selectateNumere: nextSelectate, linkPairs: nextLinkPairs }
}
