// Abonare la modificări live (INSERT/UPDATE/DELETE) pe un tabel, prin
// Supabase Realtime — folosit ca să reflecte automat (fără refresh manual)
// bifările de etape și alte schimbări în ecranele care le afișează agregat
// (Kanban, Dashboard). Necesită ca tabelul să fie adăugat la publicația
// `supabase_realtime` din Supabase (vezi blocul de la finalul schema.sql).
import { supabase } from './supabaseClient'

export function subscribeToTable(table, onChange) {
  const channel = supabase
    .channel(`realtime-${table}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
