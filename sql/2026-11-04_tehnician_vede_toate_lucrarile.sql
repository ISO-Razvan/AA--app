-- Tehnicienii văd Lista și Kanban-ul cu TOATE lucrările laboratorului, doar pentru
-- citire și fără coloane financiare.
--
-- Se rulează O SINGURĂ DATĂ în Supabase: SQL Editor -> New query -> lipești tot
-- fișierul -> Run. E idempotent (poate fi rulat din nou fără probleme).
--
-- Ce face:
--  1. View-ul lucrari_vizibile întoarce toate lucrările și pentru tehnician
--     (înainte: doar cele în care are o etapă). Coloanele financiare rămân
--     null pentru oricine nu e patron — la fel ca până acum.
--  2. Tehnicianul poate CITI toate rândurile din productie_lucrare (ca Kanban-ul
--     să vadă etapa fiecărei lucrări). Scrierea rămâne neschimbată: doar bifa
--     Finalizat pe rândurile alocate lui (trigger protectie_productie_tehnician).
--
-- NU se schimbă: tabelul lucrari (tehnicianul nu îl citește direct), notele,
-- galeria, neconformitățile și salariile — rămân doar pentru lucrările lui.

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
  l.fara_comisioane
from public.lucrari l
cross join (
  select public.este_patron() as patron, public.are_acces_operational() as operational, public.tehnicianul_meu() as tehnician
) r
where r.operational
   or r.tehnician is not null;

revoke all on public.lucrari_vizibile from anon, authenticated;
grant select on public.lucrari_vizibile to authenticated;

drop policy if exists "tehnician_citire" on productie_lucrare;
create policy "tehnician_citire" on productie_lucrare for select to authenticated
  using ((select public.tehnicianul_meu()) is not null);
