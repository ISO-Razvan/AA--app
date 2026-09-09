// Generator de lucrări demo, folosit doar de butonul "+ 10 lucrări demo" din
// listă — util pentru testare, fără a introduce manual date. Fiecare rând
// trece prin `addLucrare` (dataService), la fel ca o înregistrare reală, ca
// să beneficieze de generarea nr_inregistrare, instantaneul financiar etc.

import { ORDINE_MAXILAR, ORDINE_MANDIBULA } from './fdi'
import { calculeazaDinti } from './dintiGrupuri'
import { azi as azi0, adaugaZile } from './date'

function ordineaPentru(numar) {
  if (ORDINE_MAXILAR.includes(numar)) return ORDINE_MAXILAR
  if (ORDINE_MANDIBULA.includes(numar)) return ORDINE_MANDIBULA
  return null
}

// Leagă o listă de dinți învecinați într-o singură punte (grup), indiferent
// de ordinea în care sunt dați — deduce perechile corecte din arcadă.
function dintiLegati(numere) {
  if (numere.length < 2) return calculeazaDinti(numere, [])
  const order = ordineaPentru(numere[0])
  const idxOrdonati = numere.map((n) => order.indexOf(n)).sort((a, b) => a - b)
  const linkPairs = []
  for (let i = 0; i < idxOrdonati.length - 1; i++) {
    linkPairs.push([order[idxOrdonati[i]], order[idxOrdonati[i + 1]]])
  }
  return calculeazaDinti(numere, linkPairs)
}

function azi(offsetZile = 0) {
  return adaugaZile(azi0(), offsetZile)
}

// Șabloane de lucrări demo — totul e realist (pacient, dinți, date), CU
// EXCEPȚIA `tip_lucrare`, care se completează dinamic din tipurile de
// lucrare configurate real în Setup (vezi `lucrariDemo` mai jos). Așa,
// datele demo au mereu un `tip_lucrare` valid pentru grila de Comisioane
// curentă — altfel nu generează niciodată comision (raport de audit 1.5).
const SABLOANE = [
  {
    clinica: 'DentalPlus',
    medic: 'Dr. Popescu',
    pacient: 'Ion Marinescu',
    dinti: dintiLegati([16]),
    culoare: 'A2',
    implant: false,
    model: 'Print',
    data_intrare: azi(-5),
    termen_predare: azi(5),
    nota: '',
  },
  {
    clinica: 'Smile Studio',
    medic: 'Dr. Ionescu',
    pacient: 'Maria Dumitrescu',
    dinti: dintiLegati([14, 15, 16]),
    culoare: 'A3',
    implant: false,
    model: 'Gips',
    data_intrare: azi(-3),
    termen_predare: azi(7),
    nota: '',
  },
  {
    clinica: 'DentalPlus',
    medic: 'Dr. Popescu',
    pacient: 'George Stan',
    dinti: dintiLegati([11, 21]),
    culoare: 'BL2',
    implant: false,
    model: 'Print',
    data_intrare: azi(-1),
    termen_predare: azi(4),
    nota: '',
  },
  {
    clinica: 'OrtoCenter',
    medic: 'Dr. Vasilescu',
    pacient: 'Elena Radu',
    dinti: [],
    nr_elemente: 14,
    culoare: '',
    implant: false,
    model: 'Gips',
    data_intrare: azi(-10),
    termen_predare: azi(-2),
    nota: 'Pacient sensibil, atenție la adaptare.',
    _nextDate: azi(-1),
  },
  {
    clinica: 'Smile Studio',
    medic: 'Dr. Ionescu',
    pacient: 'Andrei Constantin',
    dinti: dintiLegati([26]),
    culoare: 'A1',
    implant: false,
    model: 'Print',
    data_intrare: azi(-2),
    termen_predare: azi(3),
    nota: '',
  },
  {
    clinica: 'DentalPlus',
    medic: 'Dr. Munteanu',
    pacient: 'Ioana Preda',
    dinti: dintiLegati([46]),
    culoare: 'A3.5',
    implant: true,
    model: 'Gips',
    data_intrare: azi(-7),
    termen_predare: azi(1),
    nota: 'Implant Straumann, bont din titan.',
    _nextDate: azi(2),
  },
  {
    clinica: 'OrtoCenter',
    medic: 'Dr. Vasilescu',
    pacient: 'Mihai Toma',
    dinti: [],
    nr_elemente: 6,
    culoare: '',
    implant: false,
    model: 'Gips',
    data_intrare: azi(-4),
    termen_predare: azi(10),
    nota: '',
  },
  {
    clinica: 'Smile Studio',
    medic: 'Dr. Ionescu',
    pacient: 'Cristina Enache',
    dinti: dintiLegati([36, 37]),
    culoare: 'B2',
    implant: false,
    model: 'Print',
    data_intrare: azi(0),
    termen_predare: azi(2),
    nota: '',
  },
  {
    clinica: 'DentalPlus',
    medic: 'Dr. Popescu',
    pacient: 'Radu Iliescu',
    dinti: dintiLegati([24]),
    culoare: 'C1',
    implant: false,
    model: 'Print',
    data_intrare: azi(-1),
    termen_predare: '',
    nota: '',
  },
  {
    clinica: 'OrtoCenter',
    medic: 'Dr. Vasilescu',
    pacient: 'Alexandra Barbu',
    dinti: dintiLegati([12, 11, 21, 22]),
    culoare: 'BL1',
    implant: false,
    model: 'Gips',
    data_intrare: azi(-6),
    termen_predare: azi(-1),
    nota: 'Client VIP — prioritate.',
    _nextDate: azi(3),
  },
]

// { payload pentru addLucrare, next_date opțional adăugat ulterior printr-un updateLucrare }
// `tipuriDisponibile` = numele tipurilor de lucrare reale, configurate acum
// în Setup → Tipuri de lucrare (nu o listă fixă) — se ciclează pe șabloane.
export function lucrariDemo(tipuriDisponibile) {
  if (!Array.isArray(tipuriDisponibile) || tipuriDisponibile.length === 0) {
    throw new Error('Configurează cel puțin un tip de lucrare în Setup înainte de a genera date demo.')
  }
  return SABLOANE.map((sablon, i) => ({
    ...sablon,
    tip_lucrare: tipuriDisponibile[i % tipuriDisponibile.length],
  }))
}
