// Strat unic de acces la date, folosit de întreaga aplicație.
//
// Susținut de `supabaseAdapter` (Supabase/Postgres, vezi `schema.sql` din
// rădăcina proiectului). Implementarea anterioară, pe localStorage
// (`localStorageAdapter.js`), rămâne în cod doar ca referință istorică —
// nu mai e folosită.

import { supabaseAdapter } from './supabaseAdapter'

const adapter = supabaseAdapter

export const getLucrari = adapter.getLucrari
export const addLucrare = adapter.addLucrare
export const updateLucrare = adapter.updateLucrare
export const deleteLucrare = adapter.deleteLucrare
export const getConfigList = adapter.getConfigList
export const addConfigValue = adapter.addConfigValue
export const generateNrInregistrare = adapter.generateNrInregistrare
export const importLucrari = adapter.importLucrari
export const getEtapeProductie = adapter.getEtapeProductie
export const addEtapaProductie = adapter.addEtapaProductie
export const deleteEtapaProductie = adapter.deleteEtapaProductie
export const reordoneazaEtapeProductie = adapter.reordoneazaEtapeProductie
export const updateEtapaDurata = adapter.updateEtapaDurata
export const getTehnicieni = adapter.getTehnicieni
export const addTehnician = adapter.addTehnician
export const updateTehnician = adapter.updateTehnician
export const deleteTehnician = adapter.deleteTehnician
export const getTipuriLucrareDetaliate = adapter.getTipuriLucrareDetaliate
export const updateTipLucrareCosturi = adapter.updateTipLucrareCosturi
export const addTipLucrare = adapter.addTipLucrare
export const renameTipLucrare = adapter.renameTipLucrare
export const deleteTipLucrare = adapter.deleteTipLucrare
export const getComisioane = adapter.getComisioane
export const setComisiune = adapter.setComisiune
export const getProductieLucrare = adapter.getProductieLucrare
export const getProductieTehnician = adapter.getProductieTehnician
export const getToateAlocarile = adapter.getToateAlocarile
export const setProductieAlocare = adapter.setProductieAlocare
export const getPozeLucrare = adapter.getPozeLucrare
export const addPozaLucrare = adapter.addPozaLucrare
export const deletePozaLucrare = adapter.deletePozaLucrare
export const getLinkuriLucrare = adapter.getLinkuriLucrare
export const addLinkLucrare = adapter.addLinkLucrare
export const deleteLinkLucrare = adapter.deleteLinkLucrare
