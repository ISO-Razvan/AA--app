// Rolurile din aplicație (`profiles.rol`, vezi schema.sql):
//  - patron: acces complet, inclusiv financiar (un singur cont);
//  - coordonator: tot ce ține de comenzi și producție, fără financiar;
//  - tehnician: doar sarcinile lui, fișele lucrărilor lui și salariul lui.
// 'admin' e valoarea veche a contului principal, tratată ca patron.
// Interfața doar ascunde ce nu e permis — regulile reale sunt în baza de date.

export const ROL_PATRON = 'patron'
export const ROL_COORDONATOR = 'coordonator'
export const ROL_TEHNICIAN = 'tehnician'

const ETICHETE = {
  [ROL_PATRON]: 'Patron',
  [ROL_COORDONATOR]: 'Coordonator',
  [ROL_TEHNICIAN]: 'Tehnician',
}

export function rolul(profile) {
  const rol = profile?.rol
  return rol === 'admin' ? ROL_PATRON : rol || null
}

export const estePatron = (profile) => rolul(profile) === ROL_PATRON
export const esteTehnician = (profile) => rolul(profile) === ROL_TEHNICIAN
// Patron sau coordonator: înregistrare/editare comenzi, producție, Setup operațional.
export const areAccesOperational = (profile) => [ROL_PATRON, ROL_COORDONATOR].includes(rolul(profile))

export const etichetaRol = (profile) => ETICHETE[rolul(profile)] || ''
