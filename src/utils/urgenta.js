import { azi, adaugaZile } from './date'

const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Aceeași regulă ca în Kanban/Dashboard: „depășit" = termen înainte de azi,
// „urgent" = termen în cel mult 2 zile de azi. Fără termen → null.
export function urgentaTermen(termenPredare) {
  if (!termenPredare) return null
  const astazi = azi()
  if (termenPredare < astazi) return 'depasit'
  if (termenPredare <= adaugaZile(astazi, 2)) return 'urgent'
  return null
}

// „2026-09-25" → „25 sep".
export function dataScurta(dataStr) {
  if (!dataStr) return ''
  const [, luna, zi] = dataStr.split('-')
  if (!luna || !zi) return dataStr
  return `${Number(zi)} ${LUNI_SCURT[Number(luna) - 1] ?? luna}`
}
