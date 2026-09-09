// Abonare la modificări live (INSERT/UPDATE/DELETE) pe un tabel, prin
// Supabase Realtime — folosit ca să reflecte automat (fără refresh manual)
// bifările de etape și alte schimbări în ecranele care le afișează agregat
// (Kanban, Dashboard). Necesită ca tabelul să fie adăugat la publicația
// `supabase_realtime` din Supabase (vezi blocul de la finalul schema.sql).
import { supabase } from './supabaseClient'

// `filter` (opțional) e un filtru Postgres pe server, ex. `lucrare_id=eq.<id>`
// — util ca un canal să primească doar evenimentele relevante pentru o
// singură lucrare (fișa deschisă), nu tot tabelul.
export function subscribeToTable(table, onChange, filter) {
  const config = filter ? { event: '*', schema: 'public', table, filter } : { event: '*', schema: 'public', table }
  const channel = supabase
    .channel(`realtime-${table}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', config, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
