// Numerotație dentară FDI, aranjată ca ansamblu de două arcade ovale
// (vedere de tip odontogramă standard — dreapta pacientului în stânga
// imaginii), după modelul de referință MiOSmile.

// Ordine stânga -> dreapta pe conturul arcadei superioare (MAXILAR)
export const ORDINE_MAXILAR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]

// Ordine stânga -> dreapta pe conturul arcadei inferioare (MANDIBULA)
export const ORDINE_MANDIBULA = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

export const TOATE_NUMERELE_FDI = [...ORDINE_MAXILAR, ...ORDINE_MANDIBULA]

export function esteDinteValid(numar) {
  return TOATE_NUMERELE_FDI.includes(numar)
}

// --- Geometrie arc oval ---------------------------------------------------
// Fiecare arcadă este un arc de elipsă. Unghiul (grade) merge de la -ANGLE_SPAN/2
// (capătul din stânga) la +ANGLE_SPAN/2 (capătul din dreapta), cu 0° în vârf
// (maxilar) / în punctul cel mai de jos (mandibula).

export const ANGLE_SPAN = 200 // grade, deschiderea totală a arcului

export function unghiDinte(index, total = 16, span = ANGLE_SPAN) {
  return -span / 2 + (index * span) / (total - 1)
}

const RAD = Math.PI / 180

// Poziția unui punct pe elipsa arcadei superioare (dom deschis în jos)
export function pozitieMaxilar(thetaDeg, cx, cy, rx, ry) {
  const t = thetaDeg * RAD
  return { x: cx + rx * Math.sin(t), y: cy - ry * Math.cos(t) }
}

// Poziția unui punct pe elipsa arcadei inferioare (dom deschis în sus)
export function pozitieMandibula(thetaDeg, cx, cy, rx, ry) {
  const t = thetaDeg * RAD
  return { x: cx + rx * Math.sin(t), y: cy + ry * Math.cos(t) }
}

// Unghiul de rotație (grade) pentru ca vârful dintelui (coroana) să indice
// spre exterior (departe de centrul arcadei).
export function rotatieMaxilar(thetaDeg) {
  return thetaDeg
}

export function rotatieMandibula(thetaDeg) {
  return 180 - thetaDeg
}
