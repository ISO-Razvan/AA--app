// Strat de autentificare — Supabase Auth (email + parolă) + citirea rolului
// din tabelul `profiles`. Separat de `dataService` pentru că nu ține de
// datele operaționale ale laboratorului, ci de sesiunea utilizatorului.

import { supabase, REMEMBER_ME_KEY } from './supabaseClient'

// `rememberMe` trebuie scris ÎNAINTE de signInWithPassword — SDK-ul salvează
// sesiunea imediat ce primește răspunsul, iar `authStorage` din
// `supabaseClient.js` decide localStorage/sessionStorage citind exact
// această valoare în acel moment.
export async function signIn(email, parola, rememberMe = true) {
  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parola })
  if (error) throw error
  return data.session
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// Rolul + (dacă e tehnician) legătura cu rândul lui din `tehnicieni`.
// Rândul din `profiles` e creat manual de administrator — dacă lipsește,
// contul e autentificat dar nu are încă rol asignat.
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, rol, tehnician_id, nume')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
