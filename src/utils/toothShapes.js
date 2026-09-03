// Contururi SVG schematice, pe categorie de dinte, pentru schema dentară.
// Toate formele sunt centrate în origine, cu coroana (suprafața de mușcare)
// spre y negativ — convenția de rotație din DentalChart.jsx presupune
// exact această orientare implicită (vezi rotatieMaxilar/rotatieMandibula).

export const CATEGORIE = {
  INCISIV: 'incisiv',
  CANIN: 'canin',
  PREMOLAR: 'premolar',
  MOLAR: 'molar',
}

const INCISIVI = new Set([11, 12, 21, 22, 31, 32, 41, 42])
const CANINI = new Set([13, 23, 33, 43])
const PREMOLARI = new Set([14, 15, 24, 25, 34, 35, 44, 45])

export function categorieDinte(numar) {
  if (INCISIVI.has(numar)) return CATEGORIE.INCISIV
  if (CANINI.has(numar)) return CATEGORIE.CANIN
  if (PREMOLARI.has(numar)) return CATEGORIE.PREMOLAR
  return CATEGORIE.MOLAR
}

// Incisiv — contur de daltă, margine de mușcare dreaptă/plată.
const INCISIV_PATH = 'M -8,-19 L 8,-19 L 8,-5 C 8,5 7,13 5,17 L -5,17 C -7,13 -8,5 -8,-5 Z'

// Canin — un singur cuspid ascuțit, proeminent.
const CANIN_PATH = 'M 0,-22 L 9,-6 C 9,4 8,12 6,17 L -6,17 C -8,12 -9,4 -9,-6 Z'

// Premolar — mai scurt și mai lat decât caninul, doi cuspizi vizibili.
const PREMOLAR_PATH =
  'M -10,-9 C -11,-15 -7,-18 -4,-14 C -2,-18 2,-18 4,-14 C 7,-18 11,-15 10,-9 C 10,-1 9,9 7,15 L -7,15 C -9,9 -10,-1 -10,-9 Z'

// Molar — cel mai lat și pătrățos, suprafață ocluzală cu mai mulți cuspizi.
const MOLAR_PATH =
  'M -13,-8 C -14,-14 -10,-17 -7,-13 C -5,-16 -2,-16 0,-13 C 2,-16 5,-16 7,-13 C 10,-17 14,-14 13,-8 C 13,0 12,9 9,14 L -9,14 C -12,9 -13,0 -13,-8 Z'

const SHAPES_BY_CATEGORIE = {
  [CATEGORIE.INCISIV]: INCISIV_PATH,
  [CATEGORIE.CANIN]: CANIN_PATH,
  [CATEGORIE.PREMOLAR]: PREMOLAR_PATH,
  [CATEGORIE.MOLAR]: MOLAR_PATH,
}

export function pathPentruDinte(numar) {
  return SHAPES_BY_CATEGORIE[categorieDinte(numar)]
}

// Dintele central (selector de culoare) — coroană + rădăcină, ca element
// de focus vizual, desenat ca două forme separate (pot fi colorate distinct).
export const CENTRAL_CROWN_PATH =
  'M -15,-20 C -16,-30 -8,-36 0,-33 C 8,-36 16,-30 15,-20 C 15,-14 13,-8 10,-6 L -10,-6 C -13,-8 -15,-14 -15,-20 Z'

export const CENTRAL_ROOT_PATH =
  'M -9,-6 C -10,4 -8,14 -5,22 C -4,26 -2,29 0,29 C 2,29 4,26 5,22 C 8,14 10,4 9,-6 Z'
