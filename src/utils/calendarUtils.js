// Utilitare de calendar folosite de DatePicker — construite exclusiv cu
// componente locale de dată (an/lună/zi), niciodată prin `new Date(isoString)`
// sau `toISOString()`, ca să evităm bug-ul de fus orar documentat în
// `src/utils/date.js`.

export const LUNI = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

export const ZILE_SAPTAMANA = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']

export function parseISO(iso) {
  if (!iso) return null
  const [an, luna, zi] = iso.split('-').map(Number)
  if (!an || !luna || !zi) return null
  return { an, luna, zi }
}

export function toISO(an, luna, zi) {
  return `${an}-${String(luna).padStart(2, '0')}-${String(zi).padStart(2, '0')}`
}

export function formatAfisare(iso) {
  const p = parseISO(iso)
  if (!p) return ''
  return `${String(p.zi).padStart(2, '0')}.${String(p.luna).padStart(2, '0')}.${p.an}`
}

export function zileInLuna(an, luna) {
  return new Date(an, luna, 0).getDate()
}

// 0 = Luni .. 6 = Duminică (spre deosebire de Date#getDay(), care începe Duminica)
export function ziuaSaptamaniiPrimaZi(an, luna) {
  const d = new Date(an, luna - 1, 1).getDay()
  return d === 0 ? 6 : d - 1
}
