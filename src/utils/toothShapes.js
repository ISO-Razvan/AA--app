// Contururi SVG anatomice pentru schema dentară, privite din unghiul ocluzal
// (de sus) folosit deja de arcade. Fiecare categorie are o siluetă proprie —
// nu doar o scalare a aceleiași forme — ca tipul de dinte să fie recognoscibil
// dintr-o privire, fără să te uiți la numărul FDI.
//
// Toate formele sunt centrate în origine, cu marginea de mușcare/cuspizii
// spre y negativ — convenția de rotație din DentalChart.jsx presupune exact
// această orientare implicită (vezi rotatieMaxilar/rotatieMandibula).

export const CATEGORIE = {
  INCISIV_CENTRAL: 'incisiv-central',
  INCISIV_LATERAL: 'incisiv-lateral',
  CANIN: 'canin',
  PREMOLAR: 'premolar',
  MOLAR: 'molar',
}

const INCISIVI_CENTRALI = new Set([11, 21, 31, 41])
const INCISIVI_LATERALI = new Set([12, 22, 32, 42])
const CANINI = new Set([13, 23, 33, 43])
const PREMOLARI = new Set([14, 15, 24, 25, 34, 35, 44, 45])

export function categorieDinte(numar) {
  if (INCISIVI_CENTRALI.has(numar)) return CATEGORIE.INCISIV_CENTRAL
  if (INCISIVI_LATERALI.has(numar)) return CATEGORIE.INCISIV_LATERAL
  if (CANINI.has(numar)) return CATEGORIE.CANIN
  if (PREMOLARI.has(numar)) return CATEGORIE.PREMOLAR
  return CATEGORIE.MOLAR
}

// Incisiv — contur îngust și alungit, cu marginea de mușcare aproape dreaptă
// (silueta unei „dălți" subțiri), spre deosebire de un vârf sau un oval.
const INCISIV_PATH =
  'M -6,-12 Q -6,-14 -3,-14 L 3,-14 Q 6,-14 6,-12 L 6,7 Q 6,13 0,14 Q -6,13 -6,7 Z'

// Canin — un singur vârf central proeminent, ușor asimetric — se distinge
// clar de incisiv prin acel unghi ascuțit din partea de mușcare.
const CANIN_PATH =
  'M 0,-14 L 4.5,-7 Q 8,-2 7.5,4 Q 7,11 0,14 Q -7,11 -7.5,4 Q -8,-2 -4.5,-7 Z'

// Premolar — contur oval, cu o ușoară "talie" la mijloc și doi cuspizi
// vizibili (o mică inflexiune la mijlocul marginii de mușcare, între cele
// două umflături laterale).
const PREMOLAR_PATH =
  'M -8,-2 C -8,-9 -4.5,-13 -2,-12.5 C -0.8,-12.2 0.8,-12.2 2,-12.5 C 4.5,-13 8,-9 8,-2 ' +
  'C 8.6,3 7,9 3,12 C 1,13.3 -1,13.3 -3,12 C -7,9 -8.6,3 -8,-2 Z'

// Molar — cel mai lat și "pătrățos" contur din arcadă, cu 4 cuspizi vizibili
// (patru umflături pe colțuri). Șanțul central se desenează separat, cu un
// stroke fin (vezi MOLAR_GROOVE_PATH), peste conturul umplut.
const MOLAR_PATH =
  'M -11,-6 C -11,-11 -7,-13.8 -3,-13.3 C -1,-13 1,-13 3,-13.3 C 7,-13.8 11,-11 11,-6 ' +
  'C 11.6,-2 11.6,2 11,6 C 10.6,11 7,13.5 3,13 C 1,12.7 -1,12.7 -3,13 ' +
  'C -7,13.5 -10.6,11 -11,6 C -11.6,2 -11.6,-2 -11,-6 Z'

// Șanțul ocluzal central al molarului — o cruce simplă, desenată doar cu
// stroke (fără fill), sugerând suprafața reală de mestecat.
export const MOLAR_GROOVE_PATH = 'M -5,0 L 5,0 M 0,-5.5 L 0,5.5'

const SHAPE_BY_CATEGORIE = {
  [CATEGORIE.INCISIV_CENTRAL]: { path: INCISIV_PATH, sx: 0.98, sy: 1.05, groove: null },
  [CATEGORIE.INCISIV_LATERAL]: { path: INCISIV_PATH, sx: 0.8, sy: 0.92, groove: null },
  [CATEGORIE.CANIN]: { path: CANIN_PATH, sx: 0.88, sy: 1.05, groove: null },
  [CATEGORIE.PREMOLAR]: { path: PREMOLAR_PATH, sx: 0.98, sy: 0.96, groove: null },
  [CATEGORIE.MOLAR]: { path: MOLAR_PATH, sx: 1.05, sy: 0.96, groove: MOLAR_GROOVE_PATH },
}

// Returnează forma (path + scalare + șanț opțional) pentru un dinte, în
// funcție de categoria lui — folosit direct de <Tooth> din DentalChart.jsx.
export function formaPentruDinte(numar) {
  return SHAPE_BY_CATEGORIE[categorieDinte(numar)]
}

// Zona centrală — ilustrație curată a unui dinte complet (coroană + rădăcină,
// privit din față, linie simplă), folosită ca selector de culoare VITA.
// Coroana și rădăcina sunt path-uri separate, ca doar coroana să se
// colorereze la alegerea unei nuanțe — rădăcina rămâne mereu neutră, ca la
// un dinte real.
export const CENTER_TOOTH_CROWN_PATH =
  'M -18,2 C -20,-12 -19,-27 -12,-35 C -7,-41 7,-41 12,-35 C 19,-27 20,-12 18,2 ' +
  'C 18,9 15,14 9,14 L -9,14 C -15,14 -18,9 -18,2 Z'

export const CENTER_TOOTH_ROOT_PATH =
  'M -9,14 L 9,14 C 11,24 10,36 7,47 C 5,56 2,63 0,68 C -2,63 -5,56 -7,47 C -10,36 -11,24 -9,14 Z'

export const CENTER_TOOTH_NECK_LINE = 'M -17,5 Q 0,11 17,5'
