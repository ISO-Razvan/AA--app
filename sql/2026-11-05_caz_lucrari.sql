-- Caz = mai multe lucrări legate (același pacient), fiecare cu propriul tip de lucrare.
--
-- Se rulează O SINGURĂ DATĂ în Supabase: SQL Editor -> New query -> lipești tot
-- fișierul -> Run. E idempotent (poate fi rulat din nou fără probleme).
--
-- Ce face (nu șterge și nu modifică niciun rând existent):
--  1. Coloana nouă lucrari.caz_id (text, nullable) + index. Lucrările existente
--     rămân cu caz_id null. Pe un caz, caz_id = nr. de bază (ex. 'AA-101'), iar
--     lucrările legate au nr. 'AA-101-1', 'AA-101-2' (nr_inregistrare rămâne unic).
--  2. Drepturi pe coloană pentru utilizatorii logați (citire/scriere; politicile
--     RLS rămân neschimbate: scrie doar patronul și coordonatorul).
--  3. View-ul lucrari_vizibile întoarce și caz_id (coloană nouă, la sfârșit).
--     Restul definiției e identic cu cea de acum.
--
-- Ordinea față de aplicație nu contează pentru lucrările obișnuite; butonul
-- „+ Adaugă încă o lucrare pe acest caz" merge abia după ce rulezi acest fișier.

alter table lucrari add column if not exists caz_id text;
create index if not exists lucrari_caz_id_idx on lucrari (caz_id) where caz_id is not null;

grant select (caz_id), insert (caz_id), update (caz_id) on public.lucrari to authenticated;

create or replace view public.lucrari_vizibile
with (security_barrier = true)
as
select
  l.id,
  l.nr_inregistrare,
  l.clinica,
  l.medic,
  l.pacient,
  l.tip_lucrare,
  l.dinti,
  l.nr_elemente,
  l.culoare,
  l.implant,
  l.try_in,
  l.model,
  l.data_intrare,
  l.termen_predare,
  l.ora_programare,
  l.next_date,
  l.nota,
  l.arhivat,
  l.data_arhivare,
  l.created_at,
  case when r.patron then l.cost_laborator end as cost_laborator,
  case when r.patron then l.incasare end as incasare,
  case when r.patron then l.profit end as profit,
  case when r.patron then l.pret_dinte_simplu end as pret_dinte_simplu,
  case when r.patron then l.pret_dinte_implant end as pret_dinte_implant,
  case when r.patron then l.comisioane else '[]'::jsonb end as comisioane,
  case
    when r.patron then l.extra_uri
    else coalesce((
      select jsonb_agg(
        jsonb_build_object('extra_id', x.e -> 'extra_id', 'nume', x.e -> 'nume', 'cantitate', x.e -> 'cantitate', 'mod_taxare', x.e -> 'mod_taxare')
        order by x.ord
      )
      from jsonb_array_elements(l.extra_uri) with ordinality as x(e, ord)
      where not exists (
        select 1 from public.extra_uri s where s.id::text = x.e ->> 'extra_id' and s.sistem is not null
      )
    ), '[]'::jsonb)
  end as extra_uri,
  case when r.patron then l.adaosuri_design end as adaosuri_design,
  l.refacere_pentru,
  l.fara_incasare,
  l.fara_comisioane,
  l.caz_id
from public.lucrari l
cross join (
  select public.este_patron() as patron, public.are_acces_operational() as operational, public.tehnicianul_meu() as tehnician
) r
where r.operational
   or r.tehnician is not null;

revoke all on public.lucrari_vizibile from anon, authenticated;
grant select on public.lucrari_vizibile to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK (doar dacă vrei să anulezi; ștergi și legăturile dintre lucrări —
-- lucrările rămân, dar nu mai sunt grupate pe caz):
--
--   create or replace view public.lucrari_vizibile ... (definiția fără caz_id,
--   din sql/2026-11-04_tehnician_vede_toate_lucrarile.sql)  -- mai întâi view-ul
--   drop index if exists lucrari_caz_id_idx;
--   alter table lucrari drop column if exists caz_id;
-- ---------------------------------------------------------------------------
