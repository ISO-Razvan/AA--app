-- Task-uri → „etape de închis": evidența închiderilor retroactive.
-- Proiect Supabase: kuxcmmrxhppudbwiwmxv. (Rulat deja de patron.) Idempotent;
-- nu modifică și nu șterge date.
-- O etapă închisă retroactiv (cu o dată din trecut) poate schimba salariul unei
-- luni deja încheiate, deci rămâne înregistrat cine a închis-o și când.
-- Coloanele rețin ULTIMA închidere retroactivă; nu se șterg la debifare.

alter table productie_lucrare add column if not exists inchisa_retroactiv_la timestamptz;
alter table productie_lucrare add column if not exists inchisa_retroactiv_de text;

-- Tehnicianul nu poate modifica coloanele noi (restul regulii rămâne identic).
create or replace function public.protectie_productie_tehnician()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() null = SQL Editor / cheia de serviciu / triggerul Livrare rulat de server.
  if auth.uid() is null or public.are_acces_operational() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.lucrare_id is distinct from old.lucrare_id
     or new.etapa_id is distinct from old.etapa_id
     or new.tehnician_id is distinct from old.tehnician_id
     or new.data_planificata is distinct from old.data_planificata
     or new.created_at is distinct from old.created_at
     or new.inchisa_retroactiv_la is distinct from old.inchisa_retroactiv_la
     or new.inchisa_retroactiv_de is distinct from old.inchisa_retroactiv_de then
    raise exception 'Un tehnician poate modifica doar bifa Finalizat și data finalizării.' using errcode = '42501';
  end if;
  return new;
end;
$$;
