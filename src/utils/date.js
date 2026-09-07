// Utilitare de dată "sigure" din punct de vedere al fusului orar.
//
// `Date.prototype.toISOString()` convertește mereu la UTC. Combinat cu
// `setHours(0,0,0,0)` (miezul nopții local) sau cu aritmetică pe zile,
// asta poate întoarce data ANTERIOARĂ celei locale, în orice fus UTC+
// (inclusiv România) — miezul nopții local e încă "ieri" în UTC.
// Aceste funcții extrag anul/luna/ziua direct din componentele locale,
// fără să treacă prin UTC.

export function dataLocalaISO(date) {
  const an = date.getFullYear()
  const luna = String(date.getMonth() + 1).padStart(2, '0')
  const zi = String(date.getDate()).padStart(2, '0')
  return `${an}-${luna}-${zi}`
}

export function azi() {
  return dataLocalaISO(new Date())
}

export function adaugaZile(dataStr, n) {
  const d = new Date(`${dataStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return dataLocalaISO(d)
}
