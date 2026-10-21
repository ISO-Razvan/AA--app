// Strat de autentificare — Supabase Auth (email + parolă) + citirea rolului
// din tabelul `profiles`. Separat de `dataService` pentru că nu ține de
// datele operaționale ale laboratorului, ci de sesiunea utilizatorului.

import { supabase, REMEMBER_ME_KEY } from './supabaseClient'

// `rememberMe` trebuie scris ÎNAINTE de signInWithPassword — SDK-ul salvează
// sesiunea imediat ce primește răspunsul, iar `authStorage` din
// `supabaseClient.js` decide localStorage/sessionStorage citind exact
// această valoare în acel moment.
// Conturile de tehnician au un email sintetic (vezi worker/index.js) — la
// login se poate scrie doar partea dinainte de „@" (numele de utilizator).
const DOMENIU_TEHNICIENI = 'tehnicieni.algorithmlab.local'

export async function signIn(emailSauUtilizator, parola, rememberMe = true) {
  localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false')
  const email = emailSauUtilizator.includes('@') ? emailSauUtilizator : `${emailSauUtilizator}@${DOMENIU_TEHNICIENI}`
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parola })
  if (error) throw error
  return data.session
}

// Medicii nu au parolă: primesc un cod pe email (Supabase Auth, OTP). Doar
// conturile create de laborator — un email necunoscut nu primește cod.
// Sesiunea rămâne salvată pe dispozitiv (localStorage); baza de date cere un
// cod nou după 90 de zile (vezi sesiune_medic_valida în schema.sql).
export async function trimiteCodEmail(email) {
  localStorage.setItem(REMEMBER_ME_KEY, 'true')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

export async function verificaCodEmail(email, cod) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: cod.trim(),
    type: 'email',
  })
  if (error) throw error
  return data.session
}

export async function schimbaParola(parolaNoua) {
  const { error } = await supabase.auth.updateUser({ password: parolaNoua })
  if (error) throw error
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

// Rolul + legătura cu rândul din `tehnicieni` (tehnician) sau `medici` (medic).
// Rândul din `profiles` e creat manual de administrator — dacă lipsește,
// contul e autentificat dar nu are încă rol asignat.
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, rol, tehnician_id, medic_id, activ, nume')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
