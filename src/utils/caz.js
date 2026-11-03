// Caz = mai multe lucrări legate (același pacient), fiecare cu propriul tip și
// propriul flux de producție. `caz_id` = nr. de bază (ex. „AA-101"); lucrările
// adăugate pe caz au nr. „AA-101-1", „AA-101-2". Lucrarea de bază își păstrează
// numărul (AA-101) și face și ea parte din caz. Funcții pure, testate în caz.test.js.

const esteNumar = (v) => /^\d+$/.test(v)

// Nr. de bază al cazului din care face parte lucrarea (sau al ei, dacă nu e pe caz).
export const bazaCaz = (lucrare) => lucrare.caz_id || lucrare.nr_inregistrare

// Sufixul numeric dintr-un nr. de forma „<baza>-<n>"; 0 pentru lucrarea de bază.
function sufix(nr, baza) {
  if (nr === baza) return 0
  const prefix = `${baza}-`
  if (typeof nr === 'string' && nr.startsWith(prefix) && esteNumar(nr.slice(prefix.length))) {
    return Number(nr.slice(prefix.length))
  }
  return Number.MAX_SAFE_INTEGER
}

// Lucrările cazului, cea de bază prima, apoi după sufix. Cea de bază contează ca
// membru chiar dacă n-are (încă) caz_id completat.
export function lucrariDinCaz(lucrari, baza) {
  return lucrari
    .filter((l) => l.caz_id === baza || l.nr_inregistrare === baza)
    .sort((a, b) => {
      const d = sufix(a.nr_inregistrare, baza) - sufix(b.nr_inregistrare, baza)
      return d !== 0 ? d : (a.nr_inregistrare || '').localeCompare(b.nr_inregistrare || '', 'ro', { numeric: true })
    })
}

// Următorul nr. liber pe caz: „<baza>-<n+1>", n = cel mai mare sufix existent.
export function urmatorulNrInCaz(lucrari, baza) {
  let max = 0
  for (const l of lucrari) {
    const nr = l.nr_inregistrare
    const prefix = `${baza}-`
    if (typeof nr === 'string' && nr.startsWith(prefix) && esteNumar(nr.slice(prefix.length))) {
      max = Math.max(max, Number(nr.slice(prefix.length)))
    }
  }
  return `${baza}-${max + 1}`
}

// Cazurile cu cel puțin 2 lucrări: Map(baza -> lucrări). Restul lucrărilor nu apar.
export function cazuri(lucrari) {
  const baze = new Set(lucrari.filter((l) => l.caz_id).map((l) => l.caz_id))
  const rezultat = new Map()
  for (const baza of baze) {
    const membri = lucrariDinCaz(lucrari, baza)
    if (membri.length > 1) rezultat.set(baza, membri)
  }
  return rezultat
}

// Suma încasărilor lucrărilor din caz (null = nu se poate vedea, ca la
// coordonator/tehnician: view-ul le dă goale).
export function incasareCaz(membri) {
  if (membri.some((l) => l.incasare == null)) return null
  return membri.reduce((s, l) => s + (Number(l.incasare) || 0), 0)
}
