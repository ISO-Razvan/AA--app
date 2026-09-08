import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Lipsesc variabilele de mediu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — verifică fișierul .env din rădăcina proiectului.'
  )
}

// Cheia sub care ținem preferința „Rămâi conectat” de la login — citită de
// `authStorage` de mai jos ca să decidă unde scrie sesiunea Supabase.
export const REMEMBER_ME_KEY = 'aa_remember_me'

// Router de stocare pentru sesiune: dacă „Rămâi conectat” e bifat (implicit),
// sesiunea merge în localStorage și supraviețuiește închiderii browserului;
// dacă nu, merge în sessionStorage și dispare la închiderea tab-ului/
// browserului. `getItem` verifică ambele, pentru că nu știm dinainte unde a
// fost scrisă sesiunea curentă.
const authStorage = {
  getItem: (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key),
  setItem: (key, value) => {
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) !== 'false'
    ;(rememberMe ? localStorage : sessionStorage).setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: authStorage },
})
