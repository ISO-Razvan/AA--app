// Strat unic de acces la date, folosit de întreaga aplicație.
//
// Astăzi este susținut de `localStorageAdapter` (localStorage), cu exact
// aceeași structură de date ca schema Supabase (`src/data/schema.sql`).
// Când proiectul Supabase real este conectat, se scrie un `supabaseAdapter`
// cu aceleași funcții și se schimbă DOAR linia de import de mai jos —
// restul aplicației rămâne neschimbată.

import { localStorageAdapter } from './localStorageAdapter'

const adapter = localStorageAdapter

export const getLucrari = adapter.getLucrari
export const addLucrare = adapter.addLucrare
export const updateLucrare = adapter.updateLucrare
export const deleteLucrare = adapter.deleteLucrare
export const getConfigList = adapter.getConfigList
export const addConfigValue = adapter.addConfigValue
export const generateNrInregistrare = adapter.generateNrInregistrare
export const importLucrari = adapter.importLucrari
