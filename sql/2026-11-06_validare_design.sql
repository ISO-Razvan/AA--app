-- Validare pentru designer: „Trimite la validare" / „Finalizat" în Task-urile mele.
--
-- Se rulează O SINGURĂ DATĂ în Supabase: SQL Editor -> New query -> lipești tot
-- fișierul -> Run. E idempotent (poate fi rulat din nou fără probleme) și NU
-- modifică și nu șterge niciun rând existent.
--
-- Ce face:
--  1. productie_lucrare.trimis_la_validare_la (timestamptz, nullable): marcajul
--     „trimis la validare" de pe rândul de Design.
--  2. etape_productie.cod (text, nullable, unic când e completat): identificarea
--     stabilă a etapei Validare (nu după nume, care se poate redenumi). Etapa se
--     creează din Setup -> Etape de producție, apoi o marchezi „Etapă de validare".
--  3. Trigger: când Designul se finalizează, rândul etapei Validare se finalizează
--     automat, fără tehnician (fără comision, fără salarii).
--
-- Până creezi și marchezi etapa Validare în Setup, aplicația se comportă ca înainte.

-- Validare (designer): designerul poate trimite o lucrare „la validare" fără să
-- finalizeze designul. Marcajul stă pe rândul de Design din productie_lucrare.
alter table productie_lucrare add column if not exists trimis_la_validare_la timestamptz;

-- Cod stabil de identificare a unei etape (independent de nume, care se poate
-- redenumi). Deocamdată doar 'validare'; maximum o etapă cu același cod.
alter table etape_productie add column if not exists cod text;
create unique index if not exists etape_productie_cod_uq on etape_productie (cod) where cod is not null;

-- Când Designul se finalizează (din lista de validare, din Task-uri, Kanban sau
-- fișă), etapa Validare se marchează „sărită": rândul ei se finalizează automat,
-- FĂRĂ tehnician (deci fără comision și fără intrare în salarii). Nu atinge un rând
-- Validare deja finalizat; nu face nimic dacă nu există nicio etapă cu cod 'validare'.
-- Designul se recunoaște după nume (ca triggerul Livrare), iar numele lui nu se redenumește.
create or replace function public.trg_design_finalizat_sare_validare()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design uuid;
  v_validare uuid;
begin
  if new.finalizat is not true then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.finalizat is true then
    return new;
  end if;
  select id into v_design from etape_productie where lower(trim(nume)) = 'design' limit 1;
  if v_design is null or new.etapa_id <> v_design then
    return new;
  end if;
  select id into v_validare from etape_productie where cod = 'validare' limit 1;
  if v_validare is null then
    return new;
  end if;
  insert into productie_lucrare (lucrare_id, etapa_id, finalizat, data_finalizare)
  values (new.lucrare_id, v_validare, true, coalesce(new.data_finalizare, current_date))
  on conflict (lucrare_id, etapa_id) do update
    set finalizat = true,
        data_finalizare = coalesce(productie_lucrare.data_finalizare, excluded.data_finalizare)
    where productie_lucrare.finalizat is not true;
  return new;
end;
$$;

drop trigger if exists productie_design_sare_validare on productie_lucrare;
create trigger productie_design_sare_validare
  after insert or update of finalizat on productie_lucrare
  for each row execute function public.trg_design_finalizat_sare_validare();

-- ---------------------------------------------------------------------------
-- ROLLBACK (doar dacă vrei să anulezi; ștergi și marcajele de validare):
--
--   drop trigger if exists productie_design_sare_validare on productie_lucrare;
--   drop function if exists public.trg_design_finalizat_sare_validare();
--   drop index if exists etape_productie_cod_uq;
--   alter table etape_productie drop column if exists cod;
--   alter table productie_lucrare drop column if exists trimis_la_validare_la;
-- ---------------------------------------------------------------------------
