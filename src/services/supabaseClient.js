import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Lipsesc variabilele de mediu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — verifică fișierul .env din rădăcina proiectului.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
